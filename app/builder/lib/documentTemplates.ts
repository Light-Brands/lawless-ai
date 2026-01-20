import type { BuilderType } from '@/app/types/builder';

// Section configuration for each builder type
export const PLAN_SECTIONS = [
  { id: 'overview', title: 'Overview', description: 'Project purpose and problem being solved' },
  { id: 'goals', title: 'Goals', description: 'Primary objectives (3-5 bullet points)' },
  { id: 'target_users', title: 'Target Users', description: 'Who uses this and their needs' },
  { id: 'key_features', title: 'Key Features', description: 'Core functionality required' },
  { id: 'technical_stack', title: 'Technical Stack', description: 'Languages, frameworks, integrations' },
  { id: 'success_metrics', title: 'Success Metrics', description: 'How to measure success' },
  { id: 'timeline', title: 'Timeline', description: 'Phases and milestones' },
] as const;

export const IDENTITY_SECTIONS = [
  { id: 'brand_overview', title: 'Brand Overview', description: 'What the brand stands for' },
  { id: 'mission_statement', title: 'Mission Statement', description: 'One-sentence purpose' },
  { id: 'voice_and_tone', title: 'Voice & Tone', description: 'Communication style, words to use/avoid' },
  { id: 'visual_identity', title: 'Visual Identity', description: 'Colors, typography, logo guidelines' },
  { id: 'target_audience', title: 'Target Audience', description: 'Demographics and psychographics' },
  { id: 'brand_personality', title: 'Brand Personality', description: 'Human characteristics of the brand' },
] as const;

export function getSections(builderType: BuilderType) {
  return builderType === 'plan' ? PLAN_SECTIONS : IDENTITY_SECTIONS;
}

// Generate a complete markdown document from sections
export function generateDocument(
  brandName: string,
  builderType: BuilderType,
  sections: Record<string, string>
): string {
  const sectionConfig = getSections(builderType);
  const title = builderType === 'plan' ? `Project Plan: ${brandName}` : `Brand Identity: ${brandName}`;

  let markdown = `# ${title}\n\n`;
  markdown += `> Generated with Lawless AI Builder\n\n`;

  for (const section of sectionConfig) {
    markdown += `## ${section.title}\n`;
    if (sections[section.id]) {
      markdown += `${sections[section.id]}\n\n`;
    } else {
      markdown += `*[Not yet defined]*\n\n`;
    }
  }

  return markdown;
}

// Generate plan document template
export function generatePlanTemplate(brandName: string): string {
  return `# Project Plan: ${brandName}

> Generated with Lawless AI Builder

## Overview
*What is this project? What problem does it solve?*

## Goals
*What are the 3-5 main objectives?*

## Target Users
*Who will use this? What are their needs?*

## Key Features
*What functionality is required?*

## Technical Stack
*Languages, frameworks, integrations?*

## Success Metrics
*How will we measure success?*

## Timeline
*What are the phases and milestones?*

| Phase | Milestone | Target |
|-------|-----------|--------|
| 1     | MVP       | TBD    |
| 2     | Beta      | TBD    |
| 3     | Launch    | TBD    |
`;
}

// Generate identity document template
export function generateIdentityTemplate(brandName: string): string {
  return `# Brand Identity: ${brandName}

> Generated with Lawless AI Builder

## Brand Overview
*What does this brand represent? What makes it unique?*

## Mission Statement
*One sentence that captures the brand's purpose*

## Voice & Tone

**Characteristics:**
- *List key voice characteristics*

**Words to Use:**
- *Words that align with the brand*

**Words to Avoid:**
- *Words that don't fit the brand*

## Visual Identity

### Colors
| Name | Hex | Usage |
|------|-----|-------|
| Primary | #xxx | Main brand color |
| Secondary | #xxx | Supporting color |
| Accent | #xxx | Highlights |

### Typography
*Font choices and usage guidelines*

### Logo Guidelines
*Logo usage rules and variations*

## Target Audience

**Demographics:**
- *Age, location, income, etc.*

**Psychographics:**
- *Values, interests, lifestyle*

**Pain Points:**
- *What problems do they face?*

## Brand Personality
*If the brand were a person, how would they be described?*

- *Trait 1*
- *Trait 2*
- *Trait 3*
`;
}
