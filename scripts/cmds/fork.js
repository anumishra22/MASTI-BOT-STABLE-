module.exports = {
  config: {
    name: "fork",
    aliases: ["repo", "source"],
    version: "1.0",
    author: "Anurag Mishra",
    countDown: 3,
    role: 0,
    longDescription: "Returns the link to the official, updated fork of the bot's repository.",
    category: "system",
    guide: { en: "{pn}" }
  },

  onStart: async function({ message }) {
    const text = "✓ | Here is the source code:\n\nhttps://github.com/ntkhang03/Goat-Bot-V2\n\n" +
                 "Changes:\n1. Clean and Secure\n2. Enhanced overall performance\n3. Now using fca-anurag-miishraa\n\n" +
                 "Keep supporting^_^";
    
    message.reply(text);
  }
};