export default function Header({ onLogoClick }) {
  return (
    <div className="header" data-testid="header">
      <img
        src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogo.png`}
        alt="PeelAway Logic"
        className="header-logo"
        onClick={onLogoClick}
        style={onLogoClick ? { cursor: "pointer" } : undefined}
        data-testid="header-logo"
      />
      <div>
        <div className="header-brand">PeelAway Logic</div>
        <div className="header-title">Peel away the noise. Surface what matters.</div>
      </div>
    </div>
  );
}
