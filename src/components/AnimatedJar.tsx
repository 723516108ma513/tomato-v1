import type { PomodoroSession } from "../types";

interface AnimatedJarProps {
  sessions: PomodoroSession[];
}

function seedFrom(value: string): number {
  return [...value].reduce((seed, character) => {
    return (seed * 31 + character.charCodeAt(0)) % 997;
  }, 17);
}

export function AnimatedJar({ sessions }: AnimatedJarProps) {
  const visible = sessions.slice(0, 36).reverse();
  return (
    <div
      className="animated-jar"
      role="img"
      aria-label={`番茄罐中有 ${sessions.length} 颗已完成的专注番茄`}
    >
      <div className="jar-lid">
        <span />
      </div>
      <div className="jar-glass">
        <div className="jar-shine" />
        <div className="jar-tomatoes">
          {visible.map((session, index) => {
            const seed = seedFrom(session.id);
            const column = index % 6;
            const row = Math.floor(index / 6);
            const left = 7 + column * 15 + (seed % 7) - 3;
            const bottom = 7 + row * 15 + ((seed >> 3) % 5);
            const rotation = (seed % 35) - 17;
            return (
              <span
                key={session.id}
                className={`jar-tomato ${index === visible.length - 1 ? "is-newest" : ""}`}
                style={{
                  left: `${left}%`,
                  bottom: `${bottom}%`,
                  transform: `rotate(${rotation}deg)`,
                  zIndex: row + 1
                }}
              >
                <i />
              </span>
            );
          })}
        </div>
        {!visible.length && <span className="jar-empty-label">等待第一颗番茄</span>}
      </div>
      <div className="jar-base-shadow" />
    </div>
  );
}
