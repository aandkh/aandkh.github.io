/* Conversations for Private Mode.
 *
 * Each is a few days of ordinary texting, long enough to scroll a little.
 * day: 0 is today, -1 yesterday. time: 24-hour "HH:MM" on that day.
 * Messages dated later than the demo clock are left out when shown.
 */

export const PRESETS = [
  {
    id: "jess",
    name: "Jess",
    initial: "J",
    color: "#8E6CF0",
    blurb: "Friend. Movie plans for Saturday.",
    messages: [
      { from: "them", day: -2, time: "16:05", text: "did you finish the history reading" },
      { from: "me", day: -2, time: "16:09", text: "halfway lol" },
      { from: "them", day: -2, time: "16:10", text: "same. the part about the canals is so long" },
      { from: "me", day: -2, time: "16:12", text: "I skimmed it honestly" },
      { from: "them", day: -1, time: "19:31", text: "ok so saturday" },
      { from: "them", day: -1, time: "19:31", text: "the 7:15 or the 9:40" },
      { from: "me", day: -1, time: "19:44", text: "7:15, I have to be home by 11" },
      { from: "them", day: -1, time: "19:45", text: "fair" },
      { from: "them", day: -1, time: "19:45", text: "I'll get tickets tomorrow" },
      { from: "me", day: -1, time: "19:47", text: "👍" },
      { from: "them", day: 0, time: "17:52", text: "got them! row G" },
      { from: "me", day: 0, time: "18:03", text: "yesss" },
      { from: "them", day: 0, time: "18:04", text: "want to get food before?" },
      { from: "me", day: 0, time: "18:20", text: "maybe the taco place by the theater" },
      { from: "them", day: 0, time: "18:21", text: "perfect" },
      { from: "them", day: 0, time: "20:47", text: "wait what are you wearing to the thing on friday" },
      { from: "me", day: 0, time: "20:55", text: "no idea yet, probably the green top" },
      { from: "them", day: 0, time: "20:56", text: "cute" },
    ],
  },
  {
    id: "maddie",
    name: "Maddie",
    initial: "M",
    color: "#E0864A",
    blurb: "Lab partner. Chemistry homework.",
    messages: [
      { from: "them", day: -1, time: "15:40", text: "do you have the lab sheet from today" },
      { from: "me", day: -1, time: "15:58", text: "yeah I'll send a pic later" },
      { from: "them", day: -1, time: "15:58", text: "thank youuu" },
      { from: "them", day: -1, time: "21:12", text: "question 4 makes no sense" },
      { from: "me", day: -1, time: "21:20", text: "you have to convert to moles first" },
      { from: "me", day: -1, time: "21:20", text: "then divide by the volume" },
      { from: "them", day: -1, time: "21:26", text: "OH" },
      { from: "them", day: -1, time: "21:26", text: "ok got it" },
      { from: "them", day: 0, time: "16:30", text: "is the quiz friday or monday" },
      { from: "me", day: 0, time: "16:44", text: "monday I think" },
      { from: "them", day: 0, time: "16:45", text: "ok good" },
      { from: "them", day: 0, time: "20:10", text: "want to study sunday afternoon?" },
      { from: "me", day: 0, time: "20:31", text: "sure, library at 2?" },
      { from: "them", day: 0, time: "20:32", text: "works for me" },
    ],
  },
  {
    id: "grandma",
    name: "Grandma",
    initial: "G",
    color: "#4FA3A5",
    blurb: "Sunday dinner, and a recipe.",
    messages: [
      { from: "them", day: -3, time: "10:15", text: "Good morning sweetheart" },
      { from: "me", day: -3, time: "11:02", text: "morning grandma!" },
      { from: "them", day: -3, time: "11:04", text: "Are you coming Sunday for dinner" },
      { from: "me", day: -3, time: "11:30", text: "yes! what are you making" },
      { from: "them", day: -3, time: "11:31", text: "Pot roast and the potatoes you like" },
      { from: "me", day: -3, time: "11:31", text: "the crispy ones??" },
      { from: "them", day: -3, time: "11:33", text: "Of course" },
      { from: "them", day: -1, time: "18:40", text: "Can you ask your mom if she has my blue dish" },
      { from: "me", day: -1, time: "19:05", text: "she says yes, she'll bring it sunday" },
      { from: "them", day: -1, time: "19:06", text: "Wonderful. Love you" },
      { from: "me", day: -1, time: "19:06", text: "love you too" },
      { from: "them", day: 0, time: "19:48", text: "I found the cookie recipe you asked about" },
      { from: "them", day: 0, time: "19:49", text: "I will write it out for you Sunday" },
      { from: "me", day: 0, time: "20:15", text: "yay thank you!!" },
    ],
  },
  {
    id: "coach",
    name: "Coach Rivera",
    initial: "R",
    color: "#3F8F5F",
    blurb: "Practice times and the away game.",
    messages: [
      { from: "them", day: -2, time: "07:45", text: "Reminder: practice moved to the upper field today" },
      { from: "me", day: -2, time: "07:52", text: "ok thanks coach" },
      { from: "them", day: -1, time: "17:30", text: "Good hustle today" },
      { from: "them", day: -1, time: "17:31", text: "Bus for Saturday leaves at 8:15 sharp" },
      { from: "me", day: -1, time: "17:40", text: "got it. do we need the white jerseys" },
      { from: "them", day: -1, time: "17:42", text: "Yes, white. Bring water" },
      { from: "me", day: -1, time: "17:43", text: "ok" },
      { from: "them", day: 0, time: "16:05", text: "Stretch tonight, big week" },
      { from: "me", day: 0, time: "16:20", text: "will do" },
      { from: "them", day: 0, time: "19:10", text: "Permission slips due Thursday" },
      { from: "me", day: 0, time: "19:30", text: "my mom signed it already" },
      { from: "them", day: 0, time: "19:31", text: "Great" },
    ],
  },
];

/* A custom conversation: one message per line, "me:" marks yours. They
 * are spaced out over the evening so the timestamps look ordinary. */
export function customMessages(lines) {
  const list = String(lines || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);
  return list.map((line, i) => {
    const mine = /^me:\s*/i.test(line);
    const mins = 17 * 60 + 20 + i * 11;
    return {
      from: mine ? "me" : "them",
      day: 0,
      time: `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
      text: line.replace(/^me:\s*/i, ""),
    };
  });
}

/* The one-line texts a disguised phone receives instead of a loud alert. */
export const CODED = {
  alert: ["hey can you call me when you get a sec", "call me when you can", "you around? call me"],
  reminder: "you home yet?",
  lastcall: "??",
};
