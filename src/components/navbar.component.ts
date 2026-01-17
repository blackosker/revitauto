import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="w-full bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
        <span class="font-bold text-lg text-slate-800">RevitScript AI</span>
      </div>
      <div class="flex gap-2">
        @for (step of steps; track step.id) {
          <button 
            (click)="onSelect(step.id)"
            [class]="'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ' + 
              (currentStep() === step.id 
                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')"
          >
            <span class="mr-2 opacity-70">{{ step.number }}.</span>
            {{ step.label }}
          </button>
        }
      </div>
    </nav>
  `
})
export class NavbarComponent {
  currentStep = input.required<number>();
  stepChange = output<number>();

  steps = [
    { id: 0, number: 1, label: 'Inicio' },
    { id: 1, number: 2, label: 'Requisitos' },
    { id: 2, number: 3, label: 'Generador' },
    { id: 3, number: 4, label: 'Código' }
  ];

  onSelect(id: number) {
    this.stepChange.emit(id);
  }
}