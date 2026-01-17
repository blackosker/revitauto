import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] || '' });
  }

  async generatePythonScript(params: {
    houseFamily: string;
    treeFamily: string;
    lotWidth: number;
    setback: number;
    description: string;
  }): Promise<string> {
    
    const systemInstruction = `Eres un experto desarrollador de la API de Revit (Revit API) y Python Scripting para pyRevit.
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
   - Añade comentarios breves en el código explicando qué hace cada bloque.`;

    const userPrompt = `
      Genera un script de Python para Revit para crear un barrio residencial automatizado.
      
      Parámetros definidos por el usuario:
      - Nombre de Familia de Casa: "${params.houseFamily}"
      - Nombre de Familia de Árbol: "${params.treeFamily}"
      - Ancho del Lote deseado: ${params.lotWidth} metros
      - Retranqueo (Setback) desde la calle: ${params.setback} metros
      - Instrucciones extra del usuario: ${params.description}
      
      Lógica del Script requerida:
      1. Obtener la selección actual de líneas de modelo (ModelCurve) del usuario (usando uidoc.Selection).
      2. Iterar sobre las líneas seleccionadas.
      3. Dividir cada línea en segmentos basados en el "Ancho del Lote".
      4. Calcular el punto de inserción para la casa usando vector perpendicular y el valor de "Retranqueo".
      5. Colocar una instancia de la familia "${params.houseFamily}" en el punto calculado.
      6. En el espacio restante del lote, generar puntos aleatorios y colocar instancias de "${params.treeFamily}".
      
      Nota: Asegúrate de manejar la conversión de metros a pies correctamente como se indica en las reglas.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction
        }
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error generating script:', error);
      return '# Error al generar el script. Por favor verifica tu API Key y vuelve a intentarlo.\n# Detalles: ' + error;
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