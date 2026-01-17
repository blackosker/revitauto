import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
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
  template: `
    <div class="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <app-navbar [currentStep]="activeStep()" (stepChange)="setActiveStep($event)" />

      <main class="max-w-4xl mx-auto mt-8 px-6">
        
        <!-- STEP 0: WELCOME -->
        @if (activeStep() === 0) {
          <div class="flex flex-col items-center text-center mt-20 space-y-6 animate-fade-in">
            <div class="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-lg mb-4">
              R
            </div>
            <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Revit Neighborhood <span class="text-indigo-600">Generator</span>
            </h1>
            <p class="text-lg text-slate-600 max-w-2xl">
              Automatiza la creación de barrios residenciales en Revit usando Dynamo y Python. 
              Genera scripts personalizados con IA en segundos.
            </p>
            <button 
              (click)="setActiveStep(1)"
              class="mt-8 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105"
            >
              Comenzar Ahora
            </button>
          </div>
        }

        <!-- STEP 1: LIBRARY / CHECKLIST -->
        @if (activeStep() === 1) {
          <div class="animate-fade-in">
            <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
              <span class="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
              Requisitos Previos
            </h2>
            <p class="text-slate-600 mb-8">Asegúrate de tener estos elementos en tu proyecto de Revit antes de generar el script.</p>

            <div class="grid gap-4">
              @for (item of checklistItems; track item.id) {
                <div 
                  (click)="toggleChecklist(item.id)"
                  [class]="'p-6 rounded-xl border-2 cursor-pointer transition-all ' + 
                    (item.checked ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-indigo-300')"
                >
                  <div class="flex items-start gap-4">
                    <div [class]="'w-6 h-6 rounded flex items-center justify-center mt-1 border transition-colors ' + 
                      (item.checked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300')">
                      @if (item.checked) {
                        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      }
                    </div>
                    <div>
                      <h3 class="font-bold text-lg text-slate-800">{{ item.title }}</h3>
                      <p class="text-slate-500">{{ item.desc }}</p>
                    </div>
                  </div>
                </div>
              }
            </div>

            <div class="mt-8 flex justify-end">
              <button 
                (click)="setActiveStep(2)"
                [disabled]="!allChecked()"
                class="px-6 py-3 bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              >
                Continuar al Generador
              </button>
            </div>
          </div>
        }

        <!-- STEP 2: GENERATOR FORM -->
        @if (activeStep() === 2) {
          <div class="animate-fade-in">
             <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
              <span class="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
              Configuración del Script
            </h2>

            <form [formGroup]="generatorForm" (ngSubmit)="generateScript()" class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              
              <div class="grid md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Nombre Familia Casa</label>
                  <input formControlName="houseFamily" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                  <p class="text-xs text-slate-500 mt-1">Nombre exacto en Revit (Case Sensitive)</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Nombre Familia Árbol</label>
                  <input formControlName="treeFamily" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                </div>
              </div>

              <div class="grid md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Ancho Lote (m)</label>
                  <input formControlName="lotWidth" type="number" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Retranqueo / Setback (m)</label>
                  <input formControlName="setback" type="number" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">Instrucciones Adicionales (Opcional)</label>
                <textarea formControlName="description" rows="3" placeholder="Ej: Añadir rotación aleatoria a los árboles..." class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"></textarea>
              </div>

              <div class="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  [disabled]="generatorForm.invalid || isGenerating()"
                  class="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-lg shadow-md disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                >
                  @if (isGenerating()) {
                    <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando...
                  } @else {
                    <span>Generar Python Script</span>
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  }
                </button>
              </div>
            </form>

            @if (generatedScript()) {
              <div class="mt-8 animate-fade-in-up">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xl font-bold text-slate-800">Script Generado</h3>
                  <button (click)="copyToClipboard()" class="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                    @if (copied()) {
                      <span class="text-green-600">Copiado!</span>
                    } @else {
                      <span>Copiar al portapapeles</span>
                    }
                  </button>
                </div>
                <div class="relative group">
                  <pre class="bg-slate-900 text-slate-50 p-6 rounded-xl overflow-x-auto font-mono text-sm leading-relaxed border border-slate-800 shadow-inner max-h-[500px] overflow-y-auto">{{ generatedScript() }}</pre>
                </div>
                
                <div class="mt-6 flex justify-between items-center bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <div class="flex items-start gap-3">
                    <svg class="w-6 h-6 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 class="font-bold text-yellow-800">Siguiente Paso</h4>
                      <p class="text-sm text-yellow-700">Copia este código y pégalo dentro de un nodo "Python Script" en Dynamo.</p>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }

        <!-- CHAT WIDGET -->
        <div class="fixed bottom-6 right-6 z-40">
           @if (showChat()) {
            <div class="bg-white w-80 md:w-96 rounded-2xl shadow-2xl border border-slate-200 mb-4 animate-fade-in-up flex flex-col overflow-hidden">
              <div class="bg-indigo-600 p-4 flex justify-between items-center text-white">
                <h3 class="font-bold">Asistente IA</h3>
                <button (click)="toggleChat()" class="hover:bg-indigo-700 p-1 rounded">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div class="p-4 bg-slate-50 min-h-[150px] max-h-[300px] overflow-y-auto text-sm text-slate-700">
                @if (chatResponse()) {
                  <div class="bg-white p-3 rounded-lg shadow-sm border border-slate-100 mb-2">
                    {{ chatResponse() }}
                  </div>
                } @else {
                   <p class="text-slate-400 text-center mt-4">Pregúntame algo sobre Revit API o Python...</p>
                }
              </div>
              <div class="p-3 bg-white border-t border-slate-100">
                <input 
                  #chatInput
                  (keyup.enter)="askAi(chatInput.value); chatInput.value = ''"
                  type="text" 
                  placeholder="Escribe tu duda..." 
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                >
              </div>
            </div>
           }
           
           <button 
            (click)="toggleChat()"
            class="bg-indigo-600 hover:bg-indigo-700 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
           >
             @if (showChat()) {
               <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
             } @else {
               <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
             }
           </button>
        </div>

      </main>
    </div>
  `
})
export class AppComponent {
  private fb: FormBuilder = inject(FormBuilder);
  private geminiService = inject(GeminiService);

  activeStep = signal(0);
  isGenerating = signal(false);
  generatedScript = signal('');
  copied = signal(false);
  
  // Checklist State
  checklistItems = [
    { id: 1, title: 'Familia de Casa (Volumen)', desc: 'Un modelo genérico simple que represente la vivienda. Asegúrate de que el origen esté en el centro.', checked: false },
    { id: 2, title: 'Familia de Árbol (RPC o Proxy)', desc: 'Una familia ligera para vegetación.', checked: false },
    { id: 3, title: 'Muro Exterior Definido', desc: 'Tipos de muro ya configurados en la plantilla.', checked: false }
  ];

  // Form State
  generatorForm: FormGroup = this.fb.group({
    houseFamily: ['Casa_Volumen', [Validators.required]],
    treeFamily: ['Arbol_Simple', [Validators.required]],
    lotWidth: [12, [Validators.required, Validators.min(1)]],
    setback: [3, [Validators.required, Validators.min(0)]],
    description: ['']
  });

  // Chat State
  showChat = signal(false);
  chatResponse = signal('');

  setActiveStep(step: number) {
    this.activeStep.set(step);
    // Reset copy state when changing steps
    this.copied.set(false);
  }

  toggleChecklist(id: number) {
    const item = this.checklistItems.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
    }
  }

  allChecked(): boolean {
    return this.checklistItems.every(i => i.checked);
  }

  async generateScript() {
    if (this.generatorForm.invalid) return;

    this.isGenerating.set(true);
    this.generatedScript.set(''); 

    const params = this.generatorForm.value;
    
    try {
      const script = await this.geminiService.generatePythonScript(params);
      this.generatedScript.set(script);
    } catch (error) {
      console.error(error);
      this.generatedScript.set('# Error inesperado. Intenta de nuevo.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  async copyToClipboard() {
    const script = this.generatedScript();
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