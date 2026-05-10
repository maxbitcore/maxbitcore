import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p',
  'ul', 'ol', 'li', 'span', 'a'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

export const sanitizeHtml = (input: string | undefined | null): string => {
  if (!input) return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style'],
    FORBID_ATTR: [
      'onerror',
      'onclick',
      'onload',
      'onmouseover',
      'onpointerdown',
      'onpointerup',
      'ontouchstart',
      'ontouchend',
      'onanimationstart',
      'onanimationend',
    ],
  });
};

/** Rich product components from admin: keep inline colors (font/span style) and structure. */
const COMPONENTS_ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'br',
  'p',
  'ul',
  'ol',
  'li',
  'span',
  'a',
  'div',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'mark',
  'small',
  'sub',
  'sup',
  'blockquote',
  'pre',
  'code',
];

const COMPONENTS_ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'class',
  'id',
  'style',
  'title',
  'color',
  'face',
  'size',
  'align',
  'dir',
  'lang',
];

type SanitizeAttrHook = (
  currentNode: Element,
  data: { attrName?: string; attrValue?: string; keepAttr?: boolean }
) => void;

/** Preserve execCommand colors (font color / span style) — DOMPurify may drop some style rules otherwise. */
const keepComponentColorsHook: SanitizeAttrHook = (_node, data) => {
  const name = String(data.attrName || '').toLowerCase();
  if (name === 'color') {
    data.keepAttr = true;
    return;
  }
  if (name === 'style' && typeof data.attrValue === 'string') {
    const v = data.attrValue.trim().toLowerCase();
    if (
      v.includes('color') ||
      v.includes('background') ||
      v.includes('font-weight') ||
      v.includes('text-decoration')
    ) {
      data.keepAttr = true;
    }
  }
};

export const sanitizeProductComponentsHtml = (input: string | undefined | null): string => {
  if (!input) return '';

  DOMPurify.addHook('uponSanitizeAttribute', keepComponentColorsHook);
  try {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: COMPONENTS_ALLOWED_TAGS,
      ALLOWED_ATTR: COMPONENTS_ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'textarea',
        'select',
        'link',
        'meta',
      ],
      FORBID_ATTR: [
        'onerror',
        'onclick',
        'onload',
        'onmouseover',
        'onfocus',
        'onblur',
        'onmouseenter',
        'onmouseleave',
        'oninput',
        'onkeydown',
        'onkeyup',
        'onpointerdown',
        'onpointerup',
        'ontouchstart',
        'ontouchend',
        'onanimationstart',
        'onanimationend',
      ],
    });
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', keepComponentColorsHook);
  }
};
