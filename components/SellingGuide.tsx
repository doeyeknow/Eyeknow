"use client";

/** The selling guide: practical tips for affiliates on how to
 *  actually sell readings, written only from the program's real
 *  offers and rules — the free preview, the 10 free readings in
 *  every full reading, the honest traditional-reading framing,
 *  and the real earnings. Shown in the dashboard's Sharing flow
 *  and in the team app's Support tab, next to the setup guide's
 *  short version. */

const SECTIONS: Array<{ title: string; tips: string[] }> = [
  {
    title: "Start with your own reading",
    tips: [
      "Get your own reading first and post about that — the “Your reading” post in the toolbox is written for it. A real reaction to your own report sells better than any description of the product.",
      "Share the details that surprised you: your constitution type, a sign that matched something real, your diet focus. Specific beats general, every time.",
    ],
  },
  {
    title: "Lead with the free preview",
    tips: [
      "Nobody has to pay to look. The free preview shows a person's top five signs and plots every point found in their iris — offer that first and let the report make the case for the full reading.",
      "“Curious what your eyes say? The first look is free” opens more doors than any price pitch.",
    ],
  },
  {
    title: "Use the 10 free readings",
    tips: [
      "Every full reading comes with 10 free readings the buyer can give away. When someone buys through you, tell them — a reading they can gift to family is worth more than one they keep.",
      "Hand your own free readings to specific people rather than broadcasting them. A personal gift (“I got you one of these”) starts a conversation a post never will — and each free reading offers its owner the full report.",
    ],
  },
  {
    title: "Put fliers where people wait",
    tips: [
      "Full-page designs are posters: community boards, shop windows, waiting rooms. Quarter-page designs are handouts and counter fliers. The cards fit wallets, registers, and bulletin-board corners.",
      "No printer? Head to your local library — most print from your phone or a USB stick for a few cents a page. Print a stack of quarter-page fliers and a sheet or two of cards in one trip and you're stocked for weeks.",
      "Hunt for bulletin boards: grocery stores, laundromats, coffee shops, libraries, community centers, gyms, churches, and feed and hardware stores often keep a public one. Where it isn't clearly public, ask first — and pin yours where eyes actually pass: by the door, the register, the coffee machine.",
      "Match the flier to the moment — the “Free preview” flier where people are browsing, the “Gift a reading” flier before holidays, the “Constitution” flier where curiosity is the hook. Every share post has a matching flier in the studio.",
      "Check your posted fliers every few weeks and replace worn ones. A fresh flier says the offer is alive; your QR code keeps working either way.",
    ],
  },
  {
    title: "Rotate the posts",
    tips: [
      "There are ten ready-made posts in the toolbox. One a day cycles through all of them in under two weeks without ever repeating yourself back-to-back.",
      "Use Share post and pick the destination — the picture and the words travel together. The Facebook, X and WhatsApp buttons use the post's own share link, so those sites pull in the right picture automatically.",
      "Tweak the wording to sound like you before sharing. The first line in your own voice outperforms the stock text.",
    ],
  },
  {
    title: "Posting from your accounts",
    tips: [
      "Share post is the automatic way: one tap, pick where it's going, and the picture, the words, and your link travel together — nothing to copy, save, or paste. That is as automatic as sharing gets, on any app, for anyone.",
      "For people you know, use Send it personally under the toolbox: pick the people from your contacts, and it lines up a ready-written text for each one, starting with their name. You tap send, come back, tap the next — nobody gets a message you didn't personally send, and it lands like the personal text it is.",
      "Why not completely hands-free? Facebook and Instagram don't allow any app to post to a personal profile automatically — that is their rule for everyone, and it exists to stop spam and account takeovers. Be wary of any service that asks for your social-media password to “post for you”: it's against the platforms' rules and it puts your account at risk. eyeKnow will never ask for it.",
      "Put your link where it works while you sleep: the bio or profile link on each of your accounts, and a pinned post if the app allows one. Set it once and it quietly sends you visitors every day.",
      "A steady rhythm beats a burst: one post a day, rotating through the toolbox, keeps you in front of people without flooding anyone — and every post carries a different picture and a different hook.",
    ],
  },
  {
    title: "Sell what comes after the first reading",
    tips: [
      "A first reading is the start: follow-up scans of the same iris unlock for $1 and build the person's Timeline — mention that when someone loves their report.",
      "For the truly hooked, the Timeline subscription is a reading of each iris every week plus a personal overview written by a real person each month — and it pays you $50 to $100 flat.",
      "Gift readings land for birthdays, holidays, and “hard to buy for” people. Books — The Ground We Stand On and The Trouble with English — pay you $3.00 each and suit the readers in your audience.",
    ],
  },
  {
    title: "Know your numbers",
    tips: [
      "You earn half of every reading sold at your price. If your price is $19.99, that's $10.00 a reading — ten readings is $100, before books and subscriptions.",
      "Your price is yours to set between $5.99 and $19.99. A lower price can mean more buyers; a higher one means more per sale. Try a price for a few weeks and judge by sales, not guesses — changes apply to future sales only.",
    ],
  },
  {
    title: "Stay honest — it protects you",
    tips: [
      "eyeKnow is a traditional reading for interest and self-reflection — never a diagnosis, and never a promise about health. Sell the curiosity and the experience, not medical claims.",
      "If someone asks whether a reading can tell them what's wrong with them, the answer is no — and saying so plainly builds the trust that makes the next sale.",
      "Never invent a discount or an offer that isn't in the toolbox. The real ones — free preview, 10 free readings, $1 follow-ups — are strong enough.",
    ],
  },
];

export default function SellingGuide() {
  return (
    <div>
      <p className="muted" style={{ marginTop: -6 }}>
        What actually works, in the order most affiliates find it useful. Everything here is
        built on the program&apos;s real offers — no hype required.
      </p>
      {SECTIONS.map((s) => (
        <div key={s.title} style={{ marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: "1rem" }}>{s.title}</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {s.tips.map((t) => (
              <li key={t.slice(0, 32)} style={{ marginBottom: 5 }}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
