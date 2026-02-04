"""Built-in skill templates for the deep agent system."""

from src.schemas.entities.skill import SkillTemplate


RESEARCH_SKILL = SkillTemplate(
    name="Research Agent",
    description=(
        "Performs comprehensive web research, searches multiple sources, "
        "and synthesizes findings into structured reports. Use for any task "
        "requiring web search, fact verification, or information gathering."
    ),
    category="research",
    system_prompt=(
        "You are a Research Specialist focused on thorough information gathering.\n\n"
        "Your approach:\n"
        "1. Break down complex queries into searchable components\n"
        "2. Search multiple sources for comprehensive coverage\n"
        "3. Cross-reference findings for accuracy\n"
        "4. Synthesize information into clear, structured reports\n"
        "5. Cite sources and note confidence levels\n\n"
        "Always prioritize accuracy over speed. When uncertain, search for verification."
    ),
    tools=["web_search", "think_tool"],
    enabled=True,
)


CODE_SKILL = SkillTemplate(
    name="Code Engineer",
    description=(
        "Writes, reviews, and refactors code with best practices. Use for any task "
        "requiring code generation, debugging, or technical implementation."
    ),
    category="engineering",
    system_prompt=(
        "You are a Code Engineer focused on clean, maintainable code.\n\n"
        "Your approach:\n"
        "1. Understand requirements before writing code\n"
        "2. Follow language-specific best practices\n"
        "3. Write clear, self-documenting code\n"
        "4. Include error handling and edge cases\n"
        "5. Test your implementations\n\n"
        "Prioritize readability and maintainability. Avoid over-engineering."
    ),
    tools=["think_tool"],
    enabled=True,
)


# List of all built-in skills
BUILTIN_SKILLS: list[SkillTemplate] = [
    RESEARCH_SKILL,
    CODE_SKILL,
]
