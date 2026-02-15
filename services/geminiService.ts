import { GoogleGenAI } from "@google/genai";
import { Product } from '../types';
import { AnalyticsData } from './analyticsService';

// --- KNOWLEDGE BASE ---
const POLICIES = `
SHIPPING (Armor-Crate Protocol):
- Domestic (NA): FedEx Ground / UPS Express. Fully insured. Signature required.
- International: DHL Express. Customer responsible for Import Duties/VAT.
- Packaging: High-density 'Instapak' foam, GPU-locking brackets.
- Handling: 24-48h processing for in-stock items. Custom builds take 7-10 days.

RETURNS:
- Window: 14 days from delivery.
- Fees: 15% restocking fee on custom systems (covers labor/testing).
- Condition: Must be original packaging. Shipping costs non-refundable.
- Non-returnable: Software keys, used coolants, user-damaged hardware, custom paint/engraving.
- DOA: Contact within 48h for prepaid return label.

WARRANTY:
- 3-Year Warranty on hardware failure.
- Free labor for repairs.
- Opening case/upgrading storage does NOT void warranty (unless user causes damage).
- Overclocking: "Safe-OC" provided by MaxBit is covered.

CONTACT:
- Email: info@maxbitcore.com
- Phone: +1 (425) 270-5500
`;

const FAQS = `
- Build Time: 7-10 business days total (3-5 assembly, 48h stress test).
- Components: Only Tier-1 brands (Corsair, Samsung, ASUS, etc.). No generics.
- Bloatware: None. Clean Windows 11 Pro install.
- Boxes: We ship a separate "Armory Accessory Box" with original manuals/cables.
`;

// --- DATA FETCHING ---

const getContextData = () => {
  let products: Product[] = [];
  let orders: any[] = [];

  try {
    // Load Products
    const rawProducts = localStorage.getItem('maxbit_published_products_v2');
    if (rawProducts) {
      products = JSON.parse(rawProducts);
    }

    // Load Orders
    const rawAnalytics = localStorage.getItem('maxbit_analytics');
    if (rawAnalytics) {
      const data: AnalyticsData = JSON.parse(rawAnalytics);
      if (data.orders) {
        orders = data.orders;
      }
    }
  } catch (e) {
    console.error("Error loading context for AI", e);
  }

  return { products, orders };
};

const buildSystemInstruction = () => {
  const { products, orders } = getContextData();

  // Format Products for AI
  const productContext = products.length > 0 
    ? products.map(p => 
        `ID: ${p.id} | Name: ${p.name} | Price: $${p.price} | Status: ${p.status} | Category: ${p.category} | Desc: ${p.description}`
      ).join('\n')
    : "No products currently visible in catalog.";

  // Format Orders for AI (Simplified for privacy/tokens, focused on ID and Status)
  const orderContext = orders.length > 0
    ? orders.map(o => 
        `Order ID: ${o.id} | Status: ${o.status} | Total: $${o.total} | Items: ${o.items.length}`
      ).join('\n')
    : "No active orders in database.";

  return `You are the MaxBit Concierge, a high-end AI specialist for a premium custom PC builder.
  
  YOUR PERSONALITY:
  - Professional, technical, cyberpunk-aesthetic, slightly robotic but helpful.
  - Use terms like "Unit," "Protocol," "Specs," "Thermal Efficiency," "Bottleneck."
  - Be concise. Do not write long paragraphs. Use bullet points.

  YOUR KNOWLEDGE BASE:
  
  === LIVE PRODUCT INVENTORY ===
  ${productContext}

  === RECENT ORDER DATABASE (Use this to answer status questions) ===
  ${orderContext}

  === OPERATIONAL PROTOCOLS (POLICIES) ===
  ${POLICIES}
  ${FAQS}

  INSTRUCTIONS:
  1. If asked about a specific product, check the Inventory list above. Give price and specs.
  2. If asked about an Order Status, ask for the Order ID (e.g., MAX-XXXX). If they provide it, check the Order Database above.
  3. If asked about shipping, returns, or warranty, refer to the Operational Protocols.
  4. If the user asks "What is this website?", explain that MaxBit is a premium custom PC builder.
  5. If asked about stock that is "Sold Out", recommend checking back in 48 hours for a supply drop.
  `;
};

export const sendMessageToGemini = async (history: {role: 'user' | 'model', text: string}[], newMessage: string): Promise<string> => {
  try {
    if (!process.env.API_KEY) return "CRITICAL ERROR: API Key missing. Neural link severed.";

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We rebuild the system instruction every time to ensure fresh data (new orders/products)
    const dynamicInstruction = buildSystemInstruction();

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview', // Flash is faster for chat interactions
      config: { 
        systemInstruction: dynamicInstruction,
        temperature: 0.7, // Balance between creative persona and factual accuracy
      },
      history: history.map(h => ({ 
        role: h.role, 
        parts: [{ text: h.text }] 
      }))
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "Data corrupted. Please re-transmit query.";
    
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Signal interference detected. Unable to process request at this time.";
  }
};