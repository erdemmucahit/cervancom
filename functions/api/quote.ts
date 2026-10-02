import { handleQuote, type QuoteEnv } from '../../server/quote.ts';

// Used when the existing site is hosted on Cloudflare Pages.
export const onRequest = ({ request, env }: { request: Request; env: QuoteEnv }) => handleQuote(request, env);
