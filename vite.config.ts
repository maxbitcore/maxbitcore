import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function metaPixelHtmlPlugin(pixelId: string): Plugin {
  const id = pixelId.trim();
  return {
    name: 'meta-pixel-html',
    transformIndexHtml(html) {
      if (!id) return html;
      const snippet = `<!-- Meta Pixel (Commerce catalog match) -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');
fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none" alt=""
src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/></noscript>`;
      return html.replace('</head>', `    ${snippet}\n  </head>`);
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    const metaPixelId = (env.VITE_META_PIXEL_ID || '').trim();
    return {
      // Root-relative URLs (/assets/...) so refreshes on /checkout, /product/:id, etc. load JS/CSS correctly.
      // Relative base './' breaks SPA routes after refresh (browser resolves ./assets from current path → HTML MIME error).
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), ...(metaPixelId ? [metaPixelHtmlPlugin(metaPixelId)] : [])],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
