export default function GuideBar({ emoji, text }) {
  return (
    <div className="guide">
      <span className="guide-emoji">{emoji}</span>
      <div className="guide-text">{text}</div>
    </div>
  );
}
