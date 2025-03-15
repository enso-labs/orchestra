from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import UUID
from src.constants import DB_URI
from src.constants.llm import ModelName, MODEL_CONFIG
from src.models import Settings

engine = create_engine(DB_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_settings(user_id=None):
    """
    Seed default settings into the database for different agents.
    
    Args:
        user_id: Optional UUID string or UUID object of the user who will own these settings.
                If not provided, you must modify this function to specify a default user_id.
    """
    if user_id is None:
        raise ValueError("A user_id must be provided to seed settings")
    
    # Convert string to UUID if needed
    if isinstance(user_id, str):
        user_id = UUID(user_id)
    
    db = SessionLocal()
    try:
        # Define agent settings
        agent_settings = [
            # Agent 1: Research Assistant
            Settings(
                user_id=user_id,
                name="Research Assistant",
                value={
                    "system": "You are a research assistant that helps users find information, summarize content, and analyze data. You excel at finding accurate information and presenting it clearly.",
                    "model":  ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
                    "tools": [
                        "search_engine",
                        "retrieval_query",
                        "sql_query_read"
                    ]
                }
            ),
            
            # Agent 2: Code Assistant
            Settings(
                user_id=user_id,
                name="Code Assistant",
                value={
                    "system": "You are a coding assistant that helps users write, debug, and optimize code. You provide clear explanations and follow best practices for software development.",
                    "model": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
                    "tools": [
                        "shell_exec",
                        "retrieval_query",
                        "retrieval_add"
                    ]
                }
            ),
            
            # Agent 3: Data Analyst
            Settings(
                user_id=user_id,
                name="Data Analyst",
                value={
                    "system": "You are a data analyst that helps users analyze and visualize data. You excel at SQL queries, data processing, and presenting insights from complex datasets.",
                    "model": ModelName.OPENAI_REASONING_O3_MINI,
                    "tools": [
                        "sql_query_read",
                        "sql_query_write",
                        "shell_exec"
                    ]
                }
            ),
            
            # Agent 4: Knowledge Base Builder
            Settings(
                user_id=user_id,
                name="Knowledge Base Builder",
                value={
                    "system": "You are a knowledge base builder that helps users organize and store information. You excel at categorizing content, creating structured data, and retrieving relevant information.",
                    "model": ModelName.OPENAI_GPT_4O_MINI,
                    "tools": [
                        "retrieval_add",
                        "retrieval_query",
                        "retrieval_load"
                    ]
                }
            ),
            
            # Agent 5: Writing Assistant (no tools)
            Settings(
                user_id=user_id,
                name="Writing Assistant",
                value={
                    "system": "You are a skilled writing assistant who helps with drafting, editing, and improving various types of content. You can assist with essays, articles, emails, creative writing, academic papers, marketing copy, and more. You provide constructive feedback, help clarify ideas, suggest improvements for clarity and style, and adapt to different writing styles and tones. You understand principles of effective communication and can help make complex ideas accessible.",
                    "model": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST
                }
            ),
            
            # Agent 6: Creativity Coach (no tools)
            Settings(
                user_id=user_id,
                name="Creativity Coach",
                value={
                    "system": "You are a creativity coach who helps users develop and refine their creative ideas. You excel at brainstorming, offering fresh perspectives, overcoming creative blocks, and developing concepts across various domains including art, writing, design, music, and innovation. You ask thoughtful questions to help users explore their ideas more deeply, suggest unexpected connections, and provide frameworks for developing creative projects from conception to completion.",
                    "model": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST
                }
            ),
            
            # Agent 7: Learning Tutor (no tools)
            Settings(
                user_id=user_id,
                name="Learning Tutor",
                value={
                    "system": "You are an educational tutor specializing in explaining complex concepts clearly and adapting to different learning styles. You help with understanding difficult topics, breaking down concepts into digestible parts, creating analogies that make sense, and providing examples that illustrate key points. You're patient, supportive, and skilled at providing explanations in multiple ways until the user understands. You cover subjects from mathematics and science to humanities, languages, and professional topics.",
                    "model": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST
                }
            ),
            
            # Agent 8: Productivity Advisor (no tools)
            Settings(
                user_id=user_id,
                name="Productivity Advisor",
                value={
                    "system": "You are a productivity advisor who helps users optimize their workflow, time management, and organization. You provide practical advice on prioritization, focus techniques, habit formation, goal setting, and overcoming procrastination. You help users create actionable plans, identify productivity bottlenecks, and implement systems that work with their natural tendencies rather than against them. You draw from evidence-based productivity methods and can tailor approaches to different work styles and contexts.",
                    "model": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST
                }
            ),
            
            # Agent 9: Decision-Making Guide (no tools)
            Settings(
                user_id=user_id,
                name="Decision-Making Guide",
                value={
                    "system": "You are a decision-making guide who helps users navigate complex choices with clarity and confidence. You assist in structuring decisions, identifying key factors and priorities, exploring alternatives, evaluating tradeoffs, and anticipating consequences. You're skilled at detecting cognitive biases and helping users think more objectively. Your approach is balanced, considering both analytical reasoning and emotional/intuitive factors. You don't make decisions for users but empower them with frameworks and perspectives to reach their own well-reasoned conclusions.",
                    "model": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST
                }
            ),
            
            # Agent 10: Emotional Intelligence Coach (no tools)
            Settings(
                user_id=user_id,
                name="Emotional Intelligence Coach",
                value={
                    "system": "You are an emotional intelligence coach who helps users understand and navigate their emotions, improve relationships, and develop greater self-awareness. You provide thoughtful perspective on interpersonal dynamics, communication challenges, conflict resolution, and personal growth. You offer frameworks for recognizing emotional patterns, practicing empathy, setting boundaries, and responding rather than reacting. Your approach is compassionate, non-judgmental, and focused on practical insights rather than clinical therapy.",
                    "model": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST
                }
            ),
        ]
        
        for setting in agent_settings:
            db.add(setting)
        
        db.commit()
        print(f"Settings created successfully for user {user_id}!")
    except Exception as e:
        print(f"Error creating settings: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    user_id = input("Please enter the user ID to create settings for: ")
    if user_id:
        seed_settings(user_id=user_id)
    else:
        print("No user ID provided. Please run again with a valid user ID.")
