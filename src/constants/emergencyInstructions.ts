
export type EmergencyInstruction = {
  id: string;
  title: string;
  body: string;
};

export const emergencyInstructions: EmergencyInstruction[] = [
  {
    id: "stay-safe",
    title: "Stay safe",
    body:
      "Move away from immediate danger if you can do so safely. " +
      "Follow instructions from official emergency services.",
  },
  {
    id: "request-help",
    title: "Request help",
    body:
      "Choose the type of help you need. Describe your situation " +
      "briefly and include a nearby landmark if possible.",
  },
  {
    id: "offline",
    title: "No internet connection?",
    body:
      "Your request can be saved on this device and queued for " +
      "later delivery. Saving locally does not alert rescuers.",
  },
  {
    id: "medical",
    title: "Medical emergency",
    body:
      "Contact emergency services as soon as possible. " +
      "Follow instructions from a qualified emergency dispatcher.",
  },
  {
    id: "emergency-contact",
    title: "Emergency services",
    body:
      "If you are in India, call 112 for emergency assistance " +
      "when you can safely make a call.",
  },
];
