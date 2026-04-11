export default function Header() {
  return (
    <div className="header">
      <img src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogo.png`} alt="PeelAway Logic" className="header-logo" />
      <div>
        <div className="header-brand">PeelAway Logic</div>
        <div className="header-title">PeelAway Logic</div>
      </div>
    </div>
  );
}
