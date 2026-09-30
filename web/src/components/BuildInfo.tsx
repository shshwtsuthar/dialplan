import { GitCommitHorizontal } from 'lucide-react';
import { config } from '@/lib/config';

export function BuildInfo() {
  const shortSha = config.commitSha.slice(0, 7);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <GitCommitHorizontal className="size-4 text-slate-400" />
      {shortSha ? (
        <span>
          Deployed from{' '}
          {config.runUrl ? (
            <a className="font-mono font-medium text-sky-700 underline-offset-2 hover:underline" href={config.runUrl}>
              {shortSha}
            </a>
          ) : (
            <span className="font-mono">{shortSha}</span>
          )}
        </span>
      ) : (
        <span>Local build</span>
      )}
      {config.repoUrl && (
        <>
          <span className="text-slate-300">·</span>
          <a className="text-sky-700 underline-offset-2 hover:underline" href={config.repoUrl}>
            Source
          </a>
        </>
      )}
    </p>
  );
}
