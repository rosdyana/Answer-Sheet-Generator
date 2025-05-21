require('dotenv').config(); // Load environment variables from .env file
const http = require('http');
const { URLSearchParams } = require('url'); // To parse form data
const { GoogleGenerativeAI } = require('@google/generative-ai');

const port = 3056;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("GEMINI_API_KEY is not set in .env file!");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(API_KEY);

const server = http.createServer(async (req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3055'); // Allow your React app
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/upload-answer-key') {
        let body = [];
        req.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', async () => {
            body = Buffer.concat(body);

            // This is a super simplified way to parse multipart/form-data
            // It's very basic and won't handle complex multipart data reliably
            // For robust parsing, you'd use 'multer' (like in the Express example)
            // or a dedicated multipart parser.
            // We'll assume the image is sent as base64 in a JSON body as an alternative
            // or that Multer is preferred for real file uploads.
            // Let's adjust React to send base64 to simplify here.
            try {
                const requestData = JSON.parse(body.toString());
                const { imageData, imageMimeType } = requestData;

                if (!imageData || !imageMimeType) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing imageData or imageMimeType.' }));
                    return;
                }

                const imagePart = {
                    inlineData: {
                        data: imageData,
                        mimeType: imageMimeType
                    }
                };

                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `You are an expert at extracting answer keys from images. The image contains a list of question numbers followed by their correct answers (A, B, C, or D).

                Extract all question numbers and their corresponding correct answers.

                Format your response as a JSON object where keys are question numbers (as strings, e.g., "101") and values are their correct answers (as single uppercase letters, e.g., "B").

                Example output:
                {"101": "B", "102": "D", "103": "C", ...}

                Ensure the JSON is perfectly valid and contains only the key-value pairs without any additional text or formatting. If a question is not found, do not include it.`;

                const result = await model.generateContent([prompt, imagePart]);
                const response = await result.response;
                const text = response.text();

                console.log("Gemini Raw Response Text:", text);

                let parsedAnswerKey;
                try {
                    parsedAnswerKey = JSON.parse(text);
                } catch (jsonParseError) {
                    console.error("Failed to parse Gemini's JSON response, attempting regex fallback:", jsonParseError);
                    const fallbackKey = {};
                    const regex = /"(\d+)":\s*"([ABCD])"/g;
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        fallbackKey[match[1]] = match[2];
                    }
                    parsedAnswerKey = fallbackKey;
                    if (Object.keys(parsedAnswerKey).length === 0) {
                        throw new Error("Gemini response was not valid JSON and regex fallback also failed to extract data.");
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ answerKey: parsedAnswerKey }));

            } catch (error) {
                console.error('Error in proxy:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message || 'Failed to process image with AI.' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(port, () => {
    console.log(`Minimal Gemini Proxy listening at http://localhost:${port}`);
});