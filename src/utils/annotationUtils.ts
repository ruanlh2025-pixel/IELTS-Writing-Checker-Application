import { DiagnosticAnnotation } from '../services/scoringService';

export interface ValidatedAnnotation extends DiagnosticAnnotation {
  id: string;
  validRange: [number, number];
}

export const validateAnnotations = (text: string, annotations: DiagnosticAnnotation[]): ValidatedAnnotation[] => {
  const validated: ValidatedAnnotation[] = [];

  annotations.forEach((ann, index) => {
    let [start, end] = ann.range;
    let validStart = start;
    let validEnd = end;
    
    // Check if the provided range actually matches the original text
    const extracted = text.substring(start, end);
    if (extracted !== ann.original) {
      // Try to find the original text in the string
      // Find all occurrences
      const indices: number[] = [];
      let i = text.indexOf(ann.original);
      while (i !== -1) {
        indices.push(i);
        i = text.indexOf(ann.original, i + 1);
      }

      if (indices.length > 0) {
        // Pick the one closest to the provided start index
        let closestIndex = indices[0];
        let minDiff = Math.abs(start - closestIndex);
        for (const idx of indices) {
          const diff = Math.abs(start - idx);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = idx;
          }
        }
        validStart = closestIndex;
        validEnd = closestIndex + ann.original.length;
      } else {
        // If not found at all, we might have to skip or just use the provided range (which might be wrong)
        // Let's just skip it to prevent breaking the UI
        console.warn(`Annotation original text not found in source: "${ann.original}"`);
        return;
      }
    }

    // Ensure it doesn't exceed text length
    if (validEnd > text.length) {
      validEnd = text.length;
    }
    if (validStart < 0) {
      validStart = 0;
    }

    validated.push({
      ...ann,
      id: `ann-${index}-${validStart}`,
      validRange: [validStart, validEnd]
    });
  });

  // Sort by start index
  validated.sort((a, b) => a.validRange[0] - b.validRange[0]);

  // Handle overlapping annotations by keeping the one that starts first, or is longer
  const nonOverlapping: ValidatedAnnotation[] = [];
  for (const ann of validated) {
    if (nonOverlapping.length === 0) {
      nonOverlapping.push(ann);
    } else {
      const last = nonOverlapping[nonOverlapping.length - 1];
      if (ann.validRange[0] < last.validRange[1]) {
        // Overlap detected. Skip the new one for simplicity, or merge.
        // For this prototype, we'll just skip overlapping annotations to avoid complex nested rendering.
        console.warn(`Skipping overlapping annotation: "${ann.original}"`);
      } else {
        nonOverlapping.push(ann);
      }
    }
  }

  return nonOverlapping;
};
