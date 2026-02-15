"""
Skill Generator Service

Uses an LLM to generate best-practice SKILL.md templates based on a name,
description, and tags, following the skill-builder-agent pattern.
"""

from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

from src.constants.llm import DEFAULT_CHAT_MODEL_BASIC
from src.utils.logger import logger

SKILL_GENERATOR_SYSTEM_PROMPT = """\
You are a skill template generator for Claude Code. You create SKILL.md files \
that follow strict best practices for modular, domain-focused skills.

## Rules

1. Output ONLY the SKILL.md body content (no YAML frontmatter — that is handled separately).
2. Keep total output under 5000 words.
3. Use imperative form ("Analyze the input" not "You should analyze").
4. Prioritize concrete examples over abstract descriptions.
5. Apply progressive disclosure: metadata (always), body (when triggered), resources (as needed).
6. Match instruction specificity to task risk:
   - High freedom for flexible approaches
   - Medium freedom for patterns with permitted variation
   - Low freedom for critical operations requiring exact procedures
7. Do NOT explain foundational concepts the LLM already knows.
8. Focus on domain-specific gaps and actionable instructions.

## Structure

Use these sections (omit any that are not applicable):

1. **Purpose**: 1-2 sentence explanation of what this skill enables.
2. **Instructions**: Numbered steps in imperative form.
3. **Examples**: Realistic scenario-based demonstrations.
4. **Guidelines**: Best practices and gotchas.
5. **Reference**: Optional command tables, API references, or templates.

## Output

Return ONLY the markdown body content. Do not wrap in code fences. \
Do not include YAML frontmatter (---). Start directly with the first section heading.\
"""


class SkillGeneratorService:
    def __init__(self, model: str | None = None):
        self.model = model or DEFAULT_CHAT_MODEL_BASIC

    async def generate(
        self,
        name: str,
        description: str,
        tags: list[str] | None = None,
    ) -> dict:
        """
        Generate a SKILL.md template using an LLM.

        Args:
            name: Kebab-case skill name.
            description: What the skill does.
            tags: Optional list of tags for context.

        Returns:
            dict with keys: content, description, tags
        """
        tags = tags or []

        llm = init_chat_model(self.model)

        user_prompt = f"Skill name: {name}\nDescription: {description}"
        if tags:
            user_prompt += f"\nTags: {', '.join(tags)}"

        messages = [
            SystemMessage(content=SKILL_GENERATOR_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        try:
            response = await llm.ainvoke(messages)
            content = response.content.strip()
        except Exception as e:
            logger.error(f"Skill generation failed: {e}")
            raise

        return {
            "content": content,
            "description": description,
            "tags": tags,
        }
