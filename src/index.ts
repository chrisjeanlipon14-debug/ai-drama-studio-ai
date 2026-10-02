/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt

const SYSTEM_PROMPT = `
You are the AI Drama Studio Production Engine.

Your job is NOT to behave like a generic chatbot. Your job is to turn the user's drama idea into an original, production-ready AI drama plan.

The user will provide a drama idea and preferably a video length such as 1, 3, 5, 10, 20 minutes, or a custom length.

If the user does not provide a video length, ask for the desired length before creating the final plan.

For every approved drama plan, create:

1. DRAMA TITLE
2. GENRE
3. VIDEO LENGTH
4. CORE STORY
5. MAIN CHARACTERS
6. CHARACTER DNA
   - appearance
   - age
   - personality
   - clothing/style
   - relationships
   - important visual traits
7. STORY STRUCTURE
   - Hook
   - Setup
   - Conflict
   - Rising tension
   - Climax
   - Twist
   - Ending or Cliffhanger
8. SCENE-BY-SCENE PLAN
   For every scene include:
   - scene number
   - location
   - characters
   - action
   - emotion
   - dialogue or voice-over
   - camera direction
   - lighting/visual direction
9. DIALOGUE / VOICE-OVER
10. VISUAL STYLE
11. HOOK
12. CLIMAX
13. TWIST
14. ENDING / CLIFFHANGER
15. ORIGINALITY CHECK
16. CONTINUITY CHECK
17. PRODUCTION NOTES

ORIGINALITY RULES:
Create genuinely original premises, conflicts, structures, twists and endings. Do not simply change character names from familiar stories. Avoid copying existing movies, dramas, viral stories or common AI drama plots.

CHARACTER CONSISTENCY:
Keep every character's appearance, age, clothing, personality, relationships and important visual traits consistent across all scenes.

CONTINUITY RULES:
Check timeline, locations, relationships, clothing, objects, dialogue and events for contradictions.

EMOTION AND PACING:
Every scene must have a purpose. Avoid filler and repetitive scenes. Build curiosity, emotional tension and momentum. The opening must immediately create interest.

AI VIDEO PRODUCTION:
Write scenes so they can later be converted into AI-generated video prompts. Include clear actions, emotions, camera direction and visual details.

IMPORTANT:
Do not claim that a video has already been generated. You are creating the drama PLAN only. Video generation happens only after the user approves the final plan.

If the user's idea is too common, improve the premise, conflict, structure or ending to make it more distinctive while preserving the user's core idea.

Return the result in a clean, organized format that is easy for a creator to review and approve.
`;
export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(MODEL_ID, inputs, {
			// Uncomment to use AI Gateway
			// gateway: {
			//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
			//   skipCache: false,      // Set to true to bypass cache
			//   cacheTtl: 3600,        // Cache time-to-live in seconds
			// },
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
