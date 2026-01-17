
import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  
  // Reusable system instruction for consistency across generation and fixing
  private readonly systemInstruction = `Eres un experto desarrollador de la API de Revit (Revit API) y Python Scripting para pyRevit.
Tu objetivo es traducir las solicitudes de lenguaje natural del usuario en código Python listo para ejecutar (Copy-Paste) dentro de Revit.

REGLAS CRÍTICAS DE GENERACIÓN DE CÓDIGO:

1. ENTORNO:
   - El código se ejecutará en pyRevit o Revit Python Shell.
   - Asume que las variables globales \`doc\` (Document) y \`uidoc\` (UIDocument) YA EXISTEN. No intentes crearlas.
   - Usa siempre: \`from Autodesk.Revit.DB import *\`

2. TRANSACCIONES:
   - CUALQUIER cambio en el modelo (crear muros, mover objetos, cambiar parámetros) DEBE estar dentro de una transacción.
   - Estructura:
     t = Transaction(doc, "Descripción de la acción")
     t.Start()
     # ... tu código aquí ...
     t.Commit()

3. UNIDADES (MUY IMPORTANTE):
   - Revit usa PIES (FEET) internamente.
   - Si el usuario pide "metros", DEBES convertir la medida.
   - Ejemplo: Para 3 metros, usa \`3 / 0.3048\` o una función helper.
   - No uses clases de conversión complejas (UnitUtils) a menos que sea estrictamente necesario, prefiere la conversión matemática simple para compatibilidad entre versiones de Revit.

4. GEOMETRÍA:
   - Usa \`XYZ(x, y, z)\` para coordenadas.
   - Usa \`Line.CreateBound(p1, p2)\` para líneas.
   - Para rotaciones, recuerda que son en Radianes.

5. SALIDA:
   - No des explicaciones teóricas largas.
   - Entrega el código dentro de un bloque de código markdown.
   - Añade comentarios breves en el código explicando qué hace cada bloque.

EJEMPLO DE ESTILO ESPERADO:

\`\`\`python
# Ejemplo: Crear un nivel
from Autodesk.Revit.DB import *
# doc = __revit__.ActiveUIDocument.Document

t = Transaction(doc, "Crear Nivel")
t.Start()
try:
    # Usar siempre Create para niveles en versiones nuevas
    Level.Create(doc, 10.0)
    t.Commit()
except Exception as e:
    t.RollBack()
    print("Error:", e)
\`\`\`

Úsalo como guía para la estructura de transacciones e importaciones.`;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] || '' });
  }

  async generatePythonScript(userDescription: string): Promise<string> {
    const userPrompt = `
      Genera un script de Python para Revit que cumpla con la siguiente solicitud del usuario:
      
      "${userDescription}"
      
      Asegúrate de importar las librerías necesarias, manejar transacciones si se modifica el modelo, y usar las variables globales doc/uidoc.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
      
      ERROR REPORTADO POR REVIT/PYREVIT:
      ${errorMessage}
      
      TAREA:
      1. Analiza la causa raíz del error (ej. problemas de indentación, uso incorrecto de la API, tipos de datos, unidades, o falta de transacción activa).
      2. Corrige el código aplicando las mejores prácticas de la API de Revit.
      3. Entrégame SOLAMENTE la versión corregida del código, lista para copiar y pegar.
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
      El usuario tiene una duda técnica.
      Pregunta: "${query}"
      Responde de forma concisa, útil y motivadora en español. Máximo 2 párrafos.
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