export default function GuideBar({ emoji, text, onStartOver }) {
  return (
    <div className="guide">
      <span className="guide-emoji">{emoji}</span>
      <div className="guide-text">{text}</div>
      {onStartOver && (
        <button className="btn danger-btn sm guide-start-over" onClick={onStartOver}>Start Over</button>
      )}
    </div>
  );
}
