import { config } from '@/lib/config';

export function BuildInfo() {
  const shortSha = config.commitSha.slice(0, 7);
  const link = 'underline decoration-border underline-offset-2 hover:decoration-foreground';
  return (
    <p className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
      {shortSha ? (
        <span>
          Deployed from{' '}
          {config.runUrl ? (
            <a className={`text-foreground tabular-nums ${link}`} href={config.runUrl}>
              {shortSha}
            </a>
          ) : (
            <span className="text-foreground tabular-nums">{shortSha}</span>
          )}
        </span>
      ) : (
        <span>Local build</span>
      )}
      {config.repoUrl && (
        <a className={`text-foreground ${link}`} href={config.repoUrl}>
          Source
        </a>
      )}
    </p>
  );
}
