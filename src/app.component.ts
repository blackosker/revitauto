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
  
  // Fix Flow State
  isFixing = signal(false);
  errorInput = signal('');
  
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
    // We replace strings and comments with placeholders first to prevent
    // highlighting keywords inside them.
    const tokens: string[] = [];
    const saveToken = (content: string) => {
      tokens.push(content);
      return `###TOKEN${tokens.length - 1}###`;
    };

    // A. Comments (Gray)
    code = code.replace(/(#.*$)/gm, match => saveToken(`<span class="text-slate-500 italic">${match}</span>`));

    // B. Strings (Green) - Handles single and double quotes
    code = code.replace(/(".*?"|'.*?')/g, match => saveToken(`<span class="text-green-400">${match}</span>`));

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

  async generateScript() {
    if (this.generatorForm.invalid) return;

    this.isGenerating.set(true);
    this.generatedScript.set(''); 
    this.errorInput.set(''); 

    const description = this.generatorForm.get('description')?.value;
    
    try {
      const script = await this.geminiService.generatePythonScript(description);
      this.generatedScript.set(script);
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
    } catch (error) {
        console.error('Fix failed', error);
    } finally {
        this.isFixing.set(false);
    }
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