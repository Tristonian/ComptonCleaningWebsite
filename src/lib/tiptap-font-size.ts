import { Extension } from '@tiptap/core';

/**
 * Tiptap ships no font-size extension; this is the documented pattern for
 * adding one — a global attribute on the `textStyle` mark rendered as an
 * inline `style`, since email clients strip <style> blocks so any styling
 * here must be inline anyway.
 */
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});
