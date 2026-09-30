import { config } from '@/lib/config';

export function BuildInfo() {
  if (!config.commitSha) {
    return <span>Local build</span>;
  }
  const shortSha = config.commitSha.slice(0, 7);
  return (
    <span>
      Deployed from{' '}
      {config.runUrl ? (
        <a className="font-mono underline underline-offset-2" href={config.runUrl}>
          {shortSha}
        </a>
      ) : (
        <span className="font-mono">{shortSha}</span>
      )}
    </span>
  );
}
