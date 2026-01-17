
import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavbarComponent } from './components/navbar.component';
import { GeminiService } from './services/gemini.service';

interface ChecklistItem {
  id: number;
  title: string;
  desc: string;
  checked: boolean;
}

interface HistoryItem {
  timestamp: Date;
  prompt: string;
  code: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, NavbarComponent, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private fb: FormBuilder = inject(FormBuilder);
  private geminiService = inject(GeminiService);
  private sanitizer: DomSanitizer = inject(DomSanitizer);

  activeStep = signal(0);
  isGenerating = signal(false);
  generatedScript = signal('');
  copied = signal(false);
  
  // History State
  scriptHistory = signal<HistoryItem[]>([]);
  
  // Fix Flow State
  isFixing = signal(false);
  errorInput = signal('');

  // Model Settings
  modelMode = signal<'flash' | 'pro'>('flash');
  showSettings = signal(false);

  // Quick Templates - Updated for Generative/Hybrid Workflow
  templates = [
    { label: '🏡 Generar Barrio', prompt: 'Detecta las Líneas de Modelo seleccionadas (Calles). Calcula lotes perpendiculares cada 10 metros. Inserta la familia "Casa_Volumen" en el centro de cada lote y aleatoriamente coloca "Arbol_Simple" en los espacios sobrantes.' },
    { label: '🌳 Dispersar Vegetación', prompt: 'Selecciona la Topografía (Toposolid) activa. Genera 50 puntos aleatorios sobre su superficie y coloca la familia "Arbol_Roble". Aplica una rotación aleatoria de 0 a 360 grados y un cambio de escala del 0.8 al 1.2 a cada instancia.' },
    { label: '🧱 Fachada Paramétrica', prompt: 'Sobre el Muro seleccionado, crea una grilla de paneles. Inserta la familia "Panel_Solar" en cada celda. Haz que el ángulo de rotación de cada panel dependa de su altura Z (más alto = más abierto).' },
    { label: '📏 Renombrar Inteligente', prompt: 'Busca todas las vistas del navegador que contengan "PLANTA" y reemplázalo por "NIVEL". Ignora las vistas de plantilla.' }
  ];
  
  // Computed signal for Syntax Highlighting
  formattedCode = computed((): SafeHtml => {
    let code = this.generatedScript();
    if (!code) return '';

    // 1. Strip Markdown backticks if present
    code = code.replace(/^```python/gm, '').replace(/^```/gm, '').trim();

    // 2. Escape HTML entities to prevent XSS before adding our own tags
    code = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 3. Tokenizer Strategy: 
    const tokens: string[] = [];
    const saveToken = (content: string) => {
      tokens.push(content);
      return `###TOKEN${tokens.length - 1}###`;
    };

    // A. Comments (Gray)
    code = code.replace(/(#.*$)/gm, match => saveToken(`<span class="text-slate-500 italic">${match}</span>`));

    // B. Strings (Green) - Handles single/double quotes AND escaped quotes (QA Fix)
    // Regex explanation: Match quote, then any escaped char OR any non-slash/non-quote char, repeated, then close quote.
    code = code.replace(/(["'])(?:\\.|[^\\])*?\1/g, match => saveToken(`<span class="text-green-400">${match}</span>`));

    // C. Keywords (Pink/Purple)
    const keywords = /\b(def|class|import|from|return|if|else|elif|try|except|for|in|while|as|print|pass|with|global|lambda)\b/g;
    code = code.replace(keywords, '<span class="text-pink-400 font-semibold">$1</span>');

    // D. Revit API & IronPython Specifics (Blue)
    const revitTypes = /\b(Transaction|doc|uidoc|TaskDialog|Level|Wall|FilteredElementCollector|XYZ|Line|Element|Parameter|BuiltInParameter|__revit__|List)\b/g;
    code = code.replace(revitTypes, '<span class="text-blue-400 font-semibold">$1</span>');

    // E. Numbers (Orange)
    code = code.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="text-orange-400">$1</span>');

    // 4. Restore tokens
    tokens.forEach((token, i) => {
      code = code.replace(`###TOKEN${i}###`, token);
    });

    return this.sanitizer.bypassSecurityTrustHtml(code);
  });
  
  // Checklist State
  checklistItems: ChecklistItem[] = [
    { id: 1, title: 'Revit Ejecutándose', desc: 'Asegúrate de tener un proyecto o familia abierta donde ejecutarás el script.', checked: false },
    { id: 2, title: 'pyRevit o Revit Python Shell', desc: 'Debes tener instalado un entorno para ejecutar scripts de Python.', checked: false },
    { id: 3, title: 'Copia de Seguridad', desc: 'Siempre guarda tu modelo antes de ejecutar scripts automáticos.', checked: false }
  ];

  // Form State
  generatorForm: FormGroup = this.fb.group({
    description: ['', [Validators.required, Validators.minLength(10)]]
  });

  // Chat State
  showChat = signal(false);
  chatResponse = signal('');

  setActiveStep(step: number) {
    this.activeStep.set(step);
    this.copied.set(false);
    this.errorInput.set(''); 
  }

  toggleChecklist(id: number) {
    this.checklistItems = this.checklistItems.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    );
  }

  allChecked(): boolean {
    return this.checklistItems.every(i => i.checked);
  }

  applyTemplate(prompt: string) {
    this.generatorForm.patchValue({ description: prompt });
  }

  restoreHistory(item: HistoryItem) {
    this.generatedScript.set(item.code);
    this.generatorForm.patchValue({ description: item.prompt });
  }

  toggleSettings() {
    this.showSettings.update(v => !v);
  }
  
  // QA: Helper to avoid $any in template
  updateErrorInput(event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    this.errorInput.set(value);
  }

  async generateScript() {
    if (this.generatorForm.invalid) return;

    this.isGenerating.set(true);
    this.generatedScript.set(''); 
    this.errorInput.set(''); 

    const description = this.generatorForm.get('description')?.value;
    
    try {
      const script = await this.geminiService.generatePythonScript(description, this.modelMode());
      this.generatedScript.set(script);

      // Add to history if successful
      if (!script.startsWith('# Error')) {
        this.addHistoryItem(description, script);
      }

    } catch (error) {
      console.error(error);
      this.generatedScript.set('# Error inesperado. Intenta de nuevo.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  async fixCode() {
    const err = this.errorInput();
    const original = this.generatedScript();
    
    if (!err.trim() || !original) return;

    this.isFixing.set(true);

    try {
        const fixedScript = await this.geminiService.fixScript(original, err);
        this.generatedScript.set(fixedScript);
        this.errorInput.set(''); 
        
        // QA Fix: Save the fixed version to history so user doesn't lose it
        const currentPrompt = this.generatorForm.get('description')?.value || 'Script corregido';
        this.addHistoryItem(`(Corrección) ${currentPrompt}`, fixedScript);
        
    } catch (error) {
        console.error('Fix failed', error);
    } finally {
        this.isFixing.set(false);
    }
  }
  
  private addHistoryItem(prompt: string, code: string) {
    this.scriptHistory.update(prev => {
      const newItem: HistoryItem = {
        timestamp: new Date(),
        prompt: prompt,
        code: code
      };
      // Keep only last 5
      return [newItem, ...prev].slice(0, 5);
    });
  }

  async copyToClipboard() {
    // Copy the raw text, not the HTML
    let script = this.generatedScript();
    
    // Clean up markdown tags for clipboard if they exist in raw text
    script = script.replace(/^```python/gm, '').replace(/^```/gm, '').trim();

    if (script) {
      try {
        await navigator.clipboard.writeText(script);
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  }

  downloadScript() {
    let script = this.generatedScript();
    // Clean up markdown tags for file download
    script = script.replace(/^```python/gm, '').replace(/^```/gm, '').trim();

    if (!script) return;

    const blob = new Blob([script], { type: 'text/x-python;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-mm-ss
    a.href = url;
    a.download = `script_revit_${timestamp}.py`;
    
    a.click();
    window.URL.revokeObjectURL(url);
  }

  toggleChat() {
    this.showChat.update(v => !v);
  }

  async askAi(question: string) {
    if(!question.trim()) return;
    this.chatResponse.set('Pensando...');
    const ans = await this.geminiService.getAiAdvice(question);
    this.chatResponse.set(ans);
  }
}
