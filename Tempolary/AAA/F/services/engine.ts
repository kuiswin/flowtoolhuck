import { Flow } from 'flow-sdk';
import { ComicProject, ComicPageData, Character, GeneratedPage } from '../types';
import { STYLE_DESCRIPTIONS } from '../constants';

export class ComicEngine {
  
  static async analyzeScript(project: ComicProject): Promise<{ pages: ComicPageData[], refinedCharacters: Partial<Character>[] }> {
    const systemPrompt = `
      You are a professional comic book visual developer.
      
      TASK:
      Partition the script into logical comic pages (average 3-4 story moments per page).
      
      IMPROVE STORY BEHAVIOR:
      - If Improve Story is ON: Lightly polish script, make dialogue clearer, improve pacing.
      - If Improve Story is OFF: Follow script strictly, do not invent new dialogue or thoughts.
      
      FOR EACH PAGE, CREATE A TEXT GUIDE:
      Classify all text into these specific roles:
      1. Spoken Dialogue: Character name + ": “Line”"
      2. Inner Thoughts: Character name + " thinks: “Line”"
      3. Narration: Descriptive captions.
      4. Location / Time Label: Cinematic tags.
      5. Sound Effects: Stylized SFX text (only if clearly implied).
      
      STRICT RULES:
      - Do not mix roles.
      - If no SFX are implied, write "Sound Effects: None".
      
      OUTPUT FORMAT: Return ONLY a valid JSON object:
      {
        "pages": [
          {
            "pageNumber": 1,
            "summary": "Visual description...",
            "characters": ["Mira", "Leo"],
            "location": "Beach",
            "textGuide": "Spoken Dialogue:\\
- Mira: “...”\\
Inner Thoughts: ...",
            "panels": [{ "description": "..." }]
          }
        ],
        "refinedCharacters": [
          { "name": "Mira", "description": "Short description...", "outfit": "Red jacket" }
        ]
      }
    `;

    const userPrompt = `
      Story Title: ${project.title}
      Improve Story Mode: ${project.improveStory ? 'ON' : 'OFF'}
      Script: ${project.script}
    `;

    const { text } = await Flow.generate.text(userPrompt, { systemInstruction: systemPrompt });
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI output missing JSON structure");
      const result = JSON.parse(jsonMatch[0]);
      
      const processedPages = result.pages.map((p: any) => ({
        ...p,
        status: 'not_generated'
      }));

      return {
        pages: processedPages,
        refinedCharacters: result.refinedCharacters || []
      };
    } catch (err) {
      console.error("Script analysis failed", err);
      return { pages: [], refinedCharacters: [] };
    }
  }

  static async generatePage(
    pageData: ComicPageData, 
    project: ComicProject,
    currentProjectCharacters: Character[],
    previousPageMediaId?: string,
    regenerationNote?: string
  ): Promise<GeneratedPage> {
    const styleDesc = STYLE_DESCRIPTIONS[project.style];
    const isBW = project.style === 'Black & White Manga';
    const isColoredManga = project.style === 'High-Impact Colored Manga';
    const isActionLayout = project.layoutStyle === 'Dynamic Action Aura Flow';
    
    // Quality Benchmarks
    let qualityInstructions = "";
    if (isBW) {
      qualityInstructions = `
        QUALITY TARGET: Premium Black-and-white manga illustration. Full-bleed, borderless, ink line art, dramatic contrast, professional screentone.
        ${isActionLayout ? "ACTION IMPACT: Explosive composition flowing edge-to-edge, dynamic diagonals, kinetic aura energy, cinematic depth without boxed margins." : ""}
      `;
    } else if (isColoredManga) {
      qualityInstructions = `
        QUALITY TARGET: Premium full-color manga illustration. Full-bleed, borderless, bold line art, cinematic lighting, vivid colors flowing edge-to-edge.
        ${isActionLayout ? "ACTION IMPACT: Kinetic energy, vibrant auras, cinematic composition with zero white gutters or borders." : ""}
      `;
    }

    // Find characters mentioned on this page
    const pageCharacters = currentProjectCharacters.filter(c => 
      pageData.characters.some(name => name.toLowerCase() === c.name.toLowerCase())
    );

    const charContext = pageCharacters
      .map(c => `CHARACTER: ${c.name}. ${c.description}. Wearing: ${c.outfitDescription || c.outfit}.`)
      .join('\
');

    const charReferenceIds = pageCharacters
      .map(c => c.referenceMediaId)
      .filter(Boolean) as string[];

    const fallbackInstruction = charReferenceIds.length === 0
      ? "\
No uploaded character reference provided. Create characters based on script, keeping them consistent."
      : "";

    const prompt = `
      MANDATORY REQUIREMENT: Create a full-bleed, edge-to-edge, borderless comic page. Fill the entire page with artwork. Do not use white borders, white gutters, white margins, panel outlines, boxed panels, framed sections, or empty white spacing. Separate story moments only through composition, overlap, depth, lighting, and cinematic visual flow.
      
      STYLE: ${styleDesc}
      ${qualityInstructions}
      COMPOSITION: ${project.layoutStyle}. FULL-BLEED, BORDERLESS EDGE-TO-EDGE ARTWORK.
      ${isBW ? 'MONOCHROME INK ONLY. NO COLOR. NO WHITE BORDERS.' : 'VIBRANT FULL COLOR. NO WHITE BORDERS.'}
      
      SCENE: ${pageData.location}
      SUMMARY: ${pageData.summary}
      ${regenerationNote ? `REVISION: ${regenerationNote}` : ''}
      
      ${charContext}
      ${fallbackInstruction}
      
      TEXT GUIDE FOR GENERATION:
      ${pageData.textGuide}
      
      TEXT RENDERING RULES (CRITICAL):
      - DO NOT literally write labels like 'Spoken Dialogue:' on the page.
      - Render only dialogue in bubbles, narration in boxes, and SFX as stylized art.
      
      STORY MOMENTS TO DRAW (BORDERLESS FLOW):
      ${pageData.panels.map((p, i) => `Moment ${i+1}: ${p.description}`).join('\
')}
    `;

    const referenceIds = [
      ...project.styleReferences.map(s => s.mediaId),
      ...charReferenceIds
    ].slice(0, 9);
    
    if (previousPageMediaId) referenceIds.push(previousPageMediaId);

    try {
      const result = await Flow.generate.image({
        prompt,
        modelDisplayName: project.model,
        aspectRatio: '3:4',
        referenceImageMediaIds: referenceIds.length > 0 ? referenceIds : undefined
      });

      return {
        id: Math.random().toString(36).substr(2, 9),
        pageNumber: pageData.pageNumber,
        base64: result.base64,
        mimeType: result.mimeType,
        mediaId: result.mediaId
      };
    } catch (err: any) {
      if (err.message?.match(/safety|policy|blocked/i)) {
        return {
          id: Math.random().toString(36).substr(2, 9),
          pageNumber: pageData.pageNumber,
          base64: '',
          mimeType: '',
          mediaId: '',
          isRejected: true
        };
      }
      throw err;
    }
  }
}