// round badge with someone's initials; the colour is picked from their name
// so the same person always gets the same colour

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4f46e5"];

function initials(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function colorFor(name) {
  let total = 0;
  for (const ch of name) total += ch.charCodeAt(0);
  return COLORS[total % COLORS.length];
}

export default function Avatar({ name, size = 28 }) {
  return (
    <span className="avatar" title={name}
      style={{ width: size, height: size, fontSize: size * 0.4, background: colorFor(name) }}>
      {initials(name)}
    </span>
  );
}
