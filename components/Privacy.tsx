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
            <p>Collected automatically when you access our Site using cookies, log files, web beacons, tags, or pixels.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">2. Payment Security</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>MaxBit does not store raw credit card data. All financial transactions are handled via industry-standard encrypted gateways (Stripe, PayPal). Your payment information is protected by SSL encryption during transmission.</p>
          </div>
        </section>
 
        <section>
          <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-cyan-500 pl-4">3. Cookies</h2>
          <div className="text-slate-400 leading-loose space-y-4">
            <p>A cookie is a small amount of information that’s downloaded to your computer or device when you visit our Site. We use a number of different cookies, including functional, performance, advertising, and social media or content cookies. Cookies make your browsing experience better by allowing the website to remember your actions and preferences (such as login and region selection). This means you don’t have to re-enter this information each time you return to the site or browse from one page to another. Cookies also provide information on how people use the website, for instance whether it’s their first time visiting or if they are a frequent visitor.</p>
            <p>You can control and manage cookies in various ways. Please keep in mind that removing or blocking cookies can negatively impact your user experience and parts of our website may no longer be fully accessible.</p>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Privacy;