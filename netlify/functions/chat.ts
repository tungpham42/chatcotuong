import { Handler } from "@netlify/functions";
import Groq from "groq-sdk";

// Khởi tạo Groq SDK
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Danh sách Model theo thứ tự ưu tiên (Chiến thuật Fallback)
const MODELS = [
  "openai/gpt-oss-120b", // Model chính
  "qwen/qwen3-32b", // Model phụ
  "openai/gpt-oss-20b", // Model dự phòng
  "llama-3.3-70b-versatile", // Model thông minh nhất
  "llama-3.1-8b-instant", // Model nhanh nhất
  "mixtral-8x7b-32768", // Model dự phòng
];

export const handler: Handler = async (event) => {
  // Chỉ chấp nhận method POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { messages } = JSON.parse(event.body || "{}");

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, body: "Invalid messages format" };
    }

    // Hàm đệ quy để thử lần lượt các model
    const getResponse = async (modelIndex: number): Promise<any> => {
      // Nếu đã thử hết danh sách mà vẫn lỗi
      if (modelIndex >= MODELS.length) {
        throw new Error("Server overloaded: All models are busy.");
      }

      const currentModel = MODELS[modelIndex];

      try {
        console.log(`Attempting to use model: ${currentModel}`);

        const completion = await groq.chat.completions.create({
          messages: messages,
          model: currentModel,
          temperature: 0.7,
          max_tokens: 1024,
        });

        // Trả về nội dung và tên model đã dùng thành công
        return {
          content: completion.choices[0]?.message?.content || "",
          usedModel: currentModel,
        };
      } catch (error: any) {
        console.warn(
          `Model ${currentModel} failed with error: ${
            error?.status || error.message
          }`
        );

        // Nếu lỗi là 429 (Rate Limit) hoặc 5xx (Server Error) -> Thử model tiếp theo
        if (error?.status === 429 || error?.status >= 500) {
          return getResponse(modelIndex + 1);
        }

        // Các lỗi khác (như sai API Key) thì dừng ngay
        throw error;
      }
    };

    // Bắt đầu chạy thử từ model đầu tiên (index 0)
    const result = await getResponse(0);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error("Critical Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    };
  }
};
