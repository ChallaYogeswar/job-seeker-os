/**
 * Generates a downloadable markdown file from stored job data
 */

export function generateJobsMarkdown(jobs) {
  if (!jobs || jobs.length === 0) {
    return '# Job Collection\n\nNo jobs collected yet.';
  }

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  let md = `# Job Collection\n`;
  md += `_Generated: ${date} · ${jobs.length} job${jobs.length !== 1 ? 's' : ''}_\n\n`;
  md += `---\n\n`;

  jobs.forEach((job, idx) => {
    md += `## ${idx + 1}. ${job.company} — ${job.role}\n\n`;

    // Meta row
    const meta = [];
    if (job.seniority && job.seniority !== 'unknown') meta.push(`**Level:** ${capitalize(job.seniority)}`);
    if (job.location && job.location !== 'Unknown') meta.push(`**Location:** ${job.location}`);
    if (job.employmentType && job.employmentType !== 'Unknown') meta.push(`**Type:** ${job.employmentType}`);
    if (job.yearsOfExperience && job.yearsOfExperience !== 'unknown') meta.push(`**Experience:** ${job.yearsOfExperience} yrs`);
    if (meta.length > 0) md += meta.join(' · ') + '\n\n';

    if (job.summary) {
      md += `**Summary:** ${job.summary}\n\n`;
    }

    if (job.mustHaveSkills?.length > 0) {
      md += `**Must-Have Skills:** ${job.mustHaveSkills.join(', ')}\n\n`;
    }

    if (job.niceToHaveSkills?.length > 0) {
      md += `**Nice-to-Have:** ${job.niceToHaveSkills.join(', ')}\n\n`;
    }

    if (job.keyRequirements?.length > 0) {
      md += `**Key Requirements:**\n`;
      job.keyRequirements.forEach(req => { md += `- ${req}\n`; });
      md += '\n';
    }

    md += `**Source:** ${job.url}\n\n`;
    md += `---\n\n`;
  });

  return md;
}

export function downloadMarkdown(content, filename = 'jobs.md') {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
