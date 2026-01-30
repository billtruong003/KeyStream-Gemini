const { GoogleGenerativeAI } = require("@google/generative-ai");
const keyService = require("./keyService");
const config = require("../config");

let dynamicModels = [];

const mapMessagesToGemini = (messages) => {
  let systemParts = [];
  const contents = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push({ text: msg.content });
    } else {
      const role = msg.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  const systemInstruction = systemParts.length > 0 ? { parts: systemParts } : undefined;
  return { contents, systemInstruction };
};

const fetchGoogleModels = async () => {
  const keyObj = keyService.getOptimalKey();
  if (!keyObj) {
    console.warn("No active keys available to fetch models.");
    return;
  }

  try {
    const response = await fetch(
      `${config.GEMINI_API_BASE_URL}?key=${keyObj.key}`,
    );
    const data = await response.json();

    if (data.models) {
      dynamicModels = data.models
        .filter(
          (m) =>
            m.supportedGenerationMethods &&
            m.supportedGenerationMethods.includes("generateContent"),
        )
        .map((m) => m.name.replace("models/", ""));

      dynamicModels.sort((a, b) => (a.includes("pro") ? -1 : 1));
      console.log(`Fetched ${dynamicModels.length} Gemini models.`);
    } else if (data.error) {
      console.error("Error fetching models from Google:", data.error.message);
    }
  } catch (e) {
    console.error("Network error fetching models:", e.message);
    if (dynamicModels.length === 0)
      dynamicModels = [
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
      ];
  }
};

const getDynamicModels = () => dynamicModels;

const initializeModelFetching = () => {
  setTimeout(fetchGoogleModels, config.INITIAL_MODEL_FETCH_DELAY);
  setInterval(fetchGoogleModels, config.MODEL_FETCH_INTERVAL);
};

const generateContent = async (apiKey, modelName, messages, generationConfig = {}, stream = false) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const { contents, systemInstruction } = mapMessagesToGemini(messages);

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  });

  if (stream) {
    return await model.generateContentStream({ 
        contents,
        generationConfig
    });
  } else {
    return await model.generateContent({ 
        contents,
        generationConfig
    });
  }
};

module.exports = {
  fetchGoogleModels,
  getDynamicModels,
  initializeModelFetching,
  generateContent,
  mapMessagesToGemini,
};