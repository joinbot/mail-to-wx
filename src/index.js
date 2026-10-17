import PostalMime from "postal-mime";

export default {
async fetch(request, env, ctx) {
return new Response("✅ 邮件处理 Worker 运行正常。", { status: 200});
},

async email(message, env, ctx) {
const parser = new PostalMime();
const parsedEmail = await parser.parse(message.raw);

const subject = parsedEmail.subject || "无主题";
const from = parsedEmail.from?.address || message.from;
const date = parsedEmail.date || new Date().toLocaleString();

let cleanBody = parsedEmail.text || parsedEmail.html || "";
if (!parsedEmail.text && parsedEmail.html) {
cleanBody = cleanBody.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
cleanBody = cleanBody.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ");
}

// 截断正文，防止超过 AI 限制
if (cleanBody.length > 2000) {
cleanBody = cleanBody.substring(0, 2000) + "\
\
...(正文过长已截断)...";
}

const aiInputText = `发件人: ${from}\
时间: ${date}\
主题: ${subject}\
\
\
${cleanBody}`;

let summary = "";
try {
if (cleanBody.length < 5) {
summary = "无法提取有效正文，可能是纯图片邮件。";
} else {
// 使用稳定的 Llama 3.2 模型
const aiResponse = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
messages: [
{
role: "system",
content: `你是一个高级邮件助理。请对邮件进行分析，严格使用纯文本输出，绝对不要使用任何 Markdown 符号(如 #, *, - 等)。
请严格按以下格式输出：


(用1句话概括)


(提取关键事实，用中文顿号隔开)


(需执行的任务，若无则填"无")`
},
{
role: "user",
content: aiInputText
}
]
});
summary = aiResponse.response;
}
} catch (e) {
console.error("AI 总结异常:", e.message);
summary = `⚠️ AI 分析失败，请直接阅读原邮件。\
\
[调试信息: ${e.message}]`;
}

// === 推送至企业微信 ===
try {
const simpleHeaders = `主题: ${subject}\
来自: ${from}`;
await sendToWeComBot(summary, simpleHeaders, env);
} catch (error) {
console.error("微信推送失败:", error);
}

// === 邮件转发 ===
const FORWARD_TO = env.FORWARD_TO_EMAIL;
if (FORWARD_TO) {
try {
await message.forward(FORWARD_TO);
} catch (error) {
console.error("邮件转发失败:", error);
}
}
}
};

// ==========================================
// 推送微信的辅助函数 (Text 纯文本模式)
// ==========================================
async function sendToWeComBot(summary, headers, env) {
const webhookUrl = env.WECOM_WEBHOOK_URL;
if (!webhookUrl) {
console.error("缺少 WECOM_WEBHOOK_URL 环境变量");
return;
}

const payload = {
msgtype: "text",
text: {
content: `💡 收到新邮件\
\
${headers}\
\
=================\
${summary}`
}
};

const response = await fetch(webhookUrl, {
method: "POST",
headers: { "Content-Type": "application/json"},
body: JSON.stringify(payload)
});

if (!response.ok) {
const errorText = await response.text();
throw new Error(`WeCom API responded with status ${response.status}: ${errorText}`);
}
}