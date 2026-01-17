
import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  
  // Updated System Instruction based on "Hybrid Workflow" and "Unbreakable Rules"
  private readonly systemInstruction = `Eres un Experto Desarrollador Python para la API de Revit.
Tu objetivo es generar scripts de automatización y diseño generativo que el usuario copiará y pegará directamente en el editor de pyRevit o RevitPythonShell.

REGLAS INQUEBRANTABLES:

1. LENGUAJE:
   - Usa Python 3. Compatible con CPython (motor moderno de pyRevit).

2. IMPORTACIONES (BOILERPLATE OBLIGATORIO):
   Siempre inicia el script con este bloque exacto:
   \`\`\`python
   import clr
   import math
   import random
   from Autodesk.Revit.DB import *
   from Autodesk.Revit.DB.Architecture import *
   from System.Collections.Generic import List
   
   doc = __revit__.ActiveUIDocument.Document
   uidoc = __revit__.ActiveUIDocument
   app = __revit__.Application
   \`\`\`

3. TRANSACCIONES:
   - Todo cambio en el modelo (Create, Delete, Modify) debe ir dentro de una transacción.
   - Estructura obligatoria:
     \`\`\`python
     t = Transaction(doc, "Nombre Descriptivo de la Accion")
     t.Start()
     try:
         # Tu logica aqui
         t.Commit()
     except Exception as e:
         t.RollBack()
         print("Error critico: {}".format(e))
     \`\`\`

4. UNIDADES (CRÍTICO):
   - El usuario te hablará en METROS.
   - Revit usa PIES (FEET) internamente.
   - DEBES convertir explícitamente cualquier input numérico de longitud.
   - Usa la constante: \`METRO_A_PIES = 3.28084\`
   - Ejemplo: \`altura_pies = 3.0 * METRO_A_PIES\`

5. FILOSOFÍA DE DISEÑO ("CEREBRO PYTHON"):
   - No generes geometría compleja vértice por vértice (Mesh/Solids) a menos que sea estrictamente necesario.
   - PREFIERE SIEMPRE instanciar familias existentes (.rfa) usando \`doc.Create.NewFamilyInstance\`.
   - Para "barrios" o "distribuciones":
     a. Detecta curvas/líneas guía.
     b. Usa lógica matemática (vectores, bucles for, random, trigonometría) para calcular coordenadas XYZ.
     c. Coloca las familias en esos puntos.

6. SALIDA:
   - Entrega el código dentro de un bloque markdown python.
   - Comenta brevemente la lógica matemática usada.

7. DICCIONARIO DEL PROYECTO (DEFINICIONES DE USUARIO):
   - "Colocar Casa": Significa instanciar la familia 'Vivienda_TipoA.rfa'. NO modelar muros sueltos.
   - "Crear Vereda": Significa crear un Suelo (Floor) con un offset de 1.5m paralelo a la línea de calle referenciada.

8. INFERENCIA LÓGICA Y VALORES POR DEFECTO (CRÍTICO):
   Si el prompt del usuario es vago o incompleto, NO pidas aclaraciones. ASUME valores estándar de la industria y documéntalos en el código.
   Aplica esta tabla de lógica por defecto:
   - ¿Falta el Nivel? -> Usa el primer nivel del proyecto (\`FilteredElementCollector...FirstElement()\`).
   - ¿Falta la Altura? -> Asume 3.0 metros (recuerda convertir a pies).
   - ¿Falta el Tipo de Muro/Familia? -> Usa el \`WallType\` o \`FamilySymbol\` por defecto (el primero disponible).
   - ¿Falta la ubicación? -> Asume el origen (0,0,0) o la selección actual si tiene sentido.
   - ¿Falta la conectividad? -> Si son muros, asume que están conectados en cadena o cerrados si son 4.
   
   IMPORTANTE: Cuando asumas un valor, añade un comentario explícito en el código Python:
   # NOTA: Se asumió altura de 3m porque no fue especificada.`;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] || '' });
  }

  async generatePythonScript(userDescription: string, modelMode: 'flash' | 'pro'): Promise<string> {
    let userPrompt = `
      Genera un script de Python para Revit siguiendo estrictamente las REGLAS INQUEBRANTABLES definidas.
      
      SOLICITUD DEL USUARIO:
      "${userDescription}"
      
      Recuerda: Convertir Metros a Pies, usar Transacciones seguras y el boilerplate de importación correcto.
    `;

    // Enhance prompt for 'pro' mode for more detailed reasoning
    if (modelMode === 'pro') {
      const proInstruction = `
        [MODO DE RAZONAMIENTO MATEMÁTICO ACTIVADO]
        Esta tarea requiere lógica espacial avanzada (vectores, trigonometría o algoritmos de distribución).
        Piensa paso a paso cómo calcular las coordenadas XYZ antes de instanciar los objetos.
      `;
      userPrompt = proInstruction + userPrompt;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', // Always use the allowed model
        contents: userPrompt,
        config: {
            systemInstruction: this.systemInstruction
        }
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error generating script:', error);
      return '# Error al generar el script. Por favor verifica tu API Key y vuelve a intentarlo.\n# Detalles: ' + error;
    }
  }

  async fixScript(originalCode: string, errorMessage: string): Promise<string> {
    const fixPrompt = `
      El siguiente script de Python para Revit generó un error al ejecutarse.
      
      CÓDIGO ORIGINAL:
      ${originalCode}
      
      ERROR REPORTADO:
      ${errorMessage}
      
      TAREA:
      1. Analiza la causa raíz (ej. indentación, Unidades, falta de Transaction, API obsoleta).
      2. Corrige el código respetando las REGLAS INQUEBRANTABLES (Imports, Transacciones, Unidades).
      3. Entrégame SOLAMENTE la versión corregida.
    `;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fixPrompt,
            config: {
                systemInstruction: this.systemInstruction
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error('Error fixing script:', error);
        return '# Error al intentar corregir el código.\n# ' + error;
    }
  }

  async getAiAdvice(query: string): Promise<string> {
     const prompt = `
      Eres un consultor BIM experto en Revit API y Python (pyRevit/Dynamo).
      Responde a la duda técnica del usuario de forma breve y directa.
      Pregunta: "${query}"
    `;
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text;
    } catch (e) {
        return "Lo siento, no puedo procesar tu consulta en este momento.";
    }
  }
}
