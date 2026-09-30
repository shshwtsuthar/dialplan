import { skyAt } from '@/lib/sky';

/** Full-page sky that follows the simulated local hour. */
export function Sky({ hour }: { hour: number }) {
  const sky = skyAt(hour);
  // The sun rises bottom-left, peaks top-centre and sets bottom-right.
  const sun = sky.sun === null ? null : { x: 8 + sky.sun * 84, y: 70 - Math.sin(Math.PI * sky.sun) * 58 };

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${sky.top}, ${sky.bottom})` }}
    >
      <div className="stars absolute inset-0" style={{ opacity: sky.stars * 0.9 }} />
      {sun && (
        <div
          className="absolute size-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100 shadow-[0_0_90px_40px_rgba(253,230,138,0.45)]"
          style={{ left: `${sun.x}%`, top: `${sun.y}%` }}
        />
      )}
      {!sky.isDay && (
        <div
          className="absolute top-[12%] right-[10%] size-12 rounded-full bg-slate-100 shadow-[0_0_40px_10px_rgba(226,232,240,0.25)]"
          style={{ opacity: sky.stars }}
        />
      )}
      <Skyline lit={sky.stars} />
    </div>
  );
}

/** A low harbour skyline along the bottom edge; windows light up at night. */
function Skyline({ lit }: { lit: number }) {
  const buildings = [
    [0, 70], [60, 110], [110, 85], [170, 150], [215, 95], [270, 125], [330, 80], [390, 170],
    [440, 105], [500, 135], [560, 90], [610, 160], [665, 115], [720, 85], [780, 140], [840, 100],
    [900, 175], [950, 110], [1010, 130], [1070, 90], [1130, 150], [1185, 105], [1240, 125], [1300, 80],
    [1350, 140], [1410, 100], [1470, 120], [1530, 85],
  ] as const;

  return (
    <svg className="absolute inset-x-0 bottom-0 h-40 w-full" viewBox="0 0 1600 180" preserveAspectRatio="none">
      <g fill="#0b1224" fillOpacity={0.55}>
        {buildings.map(([x, h]) => (
          <rect key={x} x={x} y={180 - h} width={56} height={h} />
        ))}
      </g>
      <g fill="#fde68a" opacity={lit * 0.7}>
        {buildings.flatMap(([x, h]) =>
          Array.from({ length: Math.floor(h / 30) }, (_, row) => (
            <rect key={`${x}-${row}`} x={x + 12 + ((row * 17) % 24)} y={180 - h + 14 + row * 28} width={6} height={8} />
          )),
        )}
      </g>
    </svg>
  );
}
