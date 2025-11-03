very new GitHub index.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Helper: fallback dummy course
const dummyCourse = {
  title: "Master {{TOPIC}}",
  duration: "5 Days",
  summary:
    "A comprehensive mini-course designed to take you from beginner to confident in {{TOPIC}}. This structured learning path combines theory with practical exercises.",
  totalLessons: 15,
  estimatedTime: "2-3 hours/day",
  days: [
    {
      day: 1,
      title: "Foundation & Setup",
      goals: ["Understand the basics", "Set up environment", "First exercise"],
      concepts: ["Core terminology", "Why it matters", "Basic principles"],
      exercises: ["Install tools", "Terminology quiz", "Hello world task"],
      notes: "This day covers the foundational knowledge you need to get started. You will learn basic concepts and how to set up the environment to begin hands-on exercises."
    },
    {
      day: 2,
      title: "Building Fundamentals",
      goals: ["Master essentials", "Practice techniques", "Build confidence"],
      concepts: ["Key tools", "Best practices", "Common patterns"],
      exercises: ["Guided tasks", "CLI practice", "Mini project"],
      notes: "Day two focuses on mastering fundamental techniques. You'll practice using the main tools and follow guided exercises to reinforce your understanding."
    },
    {
      day: 3,
      title: "Intermediate Concepts",
      goals: ["Explore advanced features", "Connect concepts", "Apply skills"],
      concepts: ["Advanced methods", "Integration", "Optimization"],
      exercises: ["Problem set", "Integration task", "Perf tuning"],
      notes: "This day dives into intermediate topics, connecting previous concepts and exploring more advanced features. You'll apply these skills in practical exercises."
    },
    {
      day: 4,
      title: "Practical Application",
      goals: ["Build a full project", "Test & validate", "Debug issues"],
      concepts: ["Project planning", "Testing", "Debugging"],
      exercises: ["Build project", "Write tests", "Fix bugs"],
      notes: "Day four emphasizes practical application. You'll build a full project, test it, and debug issues while consolidating your learning."
    },
    {
      day: 5,
      title: "Mastery & Next Steps",
      goals: ["Solidify knowledge", "Explore advanced topics", "Roadmap"],
      concepts: ["Advanced architectures", "Industry practices", "Trends"],
      exercises: ["Capstone", "Peer review", "Learning plan"],
      notes: "The final day helps you solidify your knowledge, explore advanced topics, and plan next steps for continued learning."
    },
  ],
  resources: [
    {
      title: "Complete Guide - YouTube",
      type: "video",
      url: "https://youtube.com",
      description: "Comprehensive video series",
    },
    {
      title: "Ultimate Handbook",
      type: "pdf",
      url: "https://example.com",
      description: "Step-by-step reference guide",
    },
    {
      title: "Community Blog",
      type: "article",
      url: "https://medium.com",
      description: "Insights, tutorials, and discussions",
    },
  ],
};

// --- Helper: extract JSON from text
const extractJson = (text) => {
  const block =
    text.match(/```json\s*([\s\S]*?)\s*```/i) ||
    text.match(/```\s*([\s\S]*?)\s*```/i);
  return (block ? block[1] : text).trim();
};

// --- Normalize course data
const normalizeCourse = (data, topic) => {
  const safe = (v, d) => (v === undefined || v === null ? d : v);

  const days = Array.isArray(data.days) ? data.days : [];
  const normDays = days.map((d, i) => ({
    day: Number(safe(d.day, i + 1)),
    title: String(safe(d.title, `Day ${i + 1}`)),
    goals: Array.isArray(d.goals) ? d.goals.map(String) : [],
    concepts: Array.isArray(d.concepts) ? d.concepts.map(String) : [],
    exercises: Array.isArray(d.exercises) ? d.exercises.map(String) : [],
    notes: String(safe(d.notes, "")),
  }));

  const resources = Array.isArray(data.resources) ? data.resources : [];
  const normResources = resources.map((r) => ({
    title: String(safe(r.title, "Resource")),
    type: ["video", "article", "pdf"].includes(r.type) ? r.type : "article",
    url: String(safe(r.url, "https://example.com")),
    description: String(safe(r.description, "")),
  }));

  return {
    title: String(safe(data.title, `Master ${topic}`)),
    duration: String(safe(data.duration, "5 Days")),
    summary: String(
      safe(
        data.summary,
        `A comprehensive mini-course designed to take you from beginner to confident in ${topic}.`
      )
    ),
    totalLessons: Number(safe(data.totalLessons, 15)),
    estimatedTime: String(safe(data.estimatedTime, "2-3 hours/day")),
    days: normDays.length ? normDays : dummyCourse.days,
    resources: normResources.length ? normResources : dummyCourse.resources,
  };
};

// --- Generate course using Gemini
const generateCourseFromGemini = async (topic) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
You are an expert instructional designer. Create a structured, personalized 5-day mini-course for the topic: "${topic}".

For each day, include:
- "day", "title", "goals", "concepts", "exercises" (3–4 items each)
- "notes": 1–2 paragraphs explaining the day's topic in detail, readable and educational.

Return ONLY valid JSON with this structure:
{
  "title": string,
  "duration": string,
  "summary": string,
  "totalLessons": number,
  "estimatedTime": string,
  "days": Array<{
    "day": number,
    "title": string,
    "goals": string[],
    "concepts": string[],
    "exercises": string[],
    "notes": string
  }>,
  "resources": Array<{
    "title": string,
    "type": "video" | "article" | "pdf",
    "url": string,
    "description": string
  }>
}
Important:
- "resources" must include at least one youtube search link of that topic, one article/blog of the topic (INTRO BLOG / ARTICLE) which explains what the topic is about, and one pdf/book link. 
-  MAKE SURE WHATEVER YOU PROVIDE IS RELATED TO THE TOPIC ONLY, NOTHING OUTSIDE OF IT.
-  Make sure notes are meaningful, detailed, and relevant to the topic of that day.
Do not include any text outside the JSON.
`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const jsonStr = extractJson(raw);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Gemini returned non-JSON. Raw output:\n", raw);
    throw new Error("Invalid JSON from model");
  }
  return parsed;
};

// --- API endpoint
app.post("/generate-course", async (req, res) => {
  const { topic } = req.body;
  if (!topic || typeof topic !== "string") {
    return res.status(400).json({ error: "Topic is required (string)" });
  }

  try {
    const data = await generateCourseFromGemini(topic);
    const normalized = normalizeCourse(data, topic);
    return res.json(normalized);
  } catch (err) {
    console.error("Gemini error, falling back to dummy course:", err.message);
    const fallback = JSON.parse(
      JSON.stringify(dummyCourse).replaceAll("{{TOPIC}}", topic)
    );
    return res.json(normalizeCourse(fallback, topic));
  }
});

// --- Health check
app.get("/", (_req, res) => res.send("Knowbit Gemini backend running"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
