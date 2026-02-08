import React from 'react';

const Privacy: React.FC = () => {
  return (
    <section className="pt-32 pb-32 px-6 max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-16">
        <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase mb-6">Data Privacy Shield</h1>
        <p className="text-slate-400 text-lg leading-relaxed">MaxBit is committed to protecting the integrity of your personal and technical data.</p>
      </div>

      <div className="space-y-16">
        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">1. Information Collection</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>We only collect information essential for the fulfillment of your hardware orders. This includes your name, shipping address, and email for build status updates. We do not profile your gaming behavior or share your data with third-party advertising networks.</p>
            <p><strong>Technical Data:</strong> During technical support sessions, we may collect system specifications and error logs to assist in troubleshooting hardware issues.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">2. Payment Security</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>MaxBit does not store raw credit card data. All financial transactions are handled via industry-standard encrypted gateways (Stripe, PayPal). Your payment information is protected by 256-bit SSL encryption during transmission.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">3. Data Retention</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>We maintain purchase records for the duration of your 3-year warranty period. This allows us to verify hardware ownership and serial numbers for RMA requests. You may request the deletion of your account at any time, which will remove all non-legal records from our servers.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">4. Your Rights</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>In accordance with GDPR and CCPA guidelines, you have the right to access, rectify, and erase your personal data. To exercise these rights, please contact our Data Protection Officer at <strong>privacy@maxbitcore.com</strong>.</p>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Privacy;