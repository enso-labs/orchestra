import unittest
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.constants import DB_URI
from src.models import Base
from src.repos.agent_repo import AgentRepo
from src.repos.settings_repo import SettingsRepo


class TestAgentRepo(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        
        cls.engine = create_engine(DB_URI)
        # Create session factory
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)

        
    @classmethod
    def tearDownClass(cls):
        # Clean up by dropping the tables
        Base.metadata.drop_all(cls.engine)
        
    def setUp(self):
        # Create a new session for each test
        self.db = self.SessionLocal()
        self.user_id = str(uuid.uuid4())
        
        # Create a test setting first
        self.settings_repo = SettingsRepo(db=self.db, user_id=self.user_id)
        self.test_setting = self.settings_repo.create(
            name="Test Setting",
            value={"key": "value"}
        )
        
        # Initialize agent repo
        self.agent_repo = AgentRepo(db=self.db, user_id=self.user_id)
        
        # Create a test agent
        self.test_agent = self.agent_repo.create(
            name="Test Agent",
            description="This is a test agent",
            settings_id=str(self.test_setting.id),
            public=False
        )

    # def test_get_by_id(self):
    #     # Test getting agent by ID
    #     agent = self.agent_repo.get_by_id(str(self.test_agent.id))
        
    #     self.assertIsNotNone(agent)
    #     self.assertEqual(agent.name, "Test Agent")
    #     self.assertEqual(agent.description, "This is a test agent")
    #     # Check that setting is loaded
    #     self.assertIsNotNone(agent.setting)
    #     self.assertEqual(agent.setting.name, "Test Setting")
        
    # def test_get_by_slug(self):
    #     # Test getting agent by slug
    #     agent = self.agent_repo.get_by_slug(self.test_agent.slug)
        
    #     self.assertIsNotNone(agent)
    #     self.assertEqual(agent.name, "Test Agent")
    #     # Check that setting is loaded
    #     self.assertIsNotNone(agent.setting)
        
    # def test_get_all(self):
        # Create another agent
        self.agent_repo.create(
            name="Another Agent",
            description="This is another test agent",
            setting_id=str(self.test_setting.id),
            public=True
        )
        
        # Test getting all agents
        agents = self.agent_repo.get_all()
        
        self.assertGreaterEqual(len(agents), 2)
        
    def test_create(self):
        # Test creating a new agent
        new_agent = self.agent_repo.create(
            name="New Agent",
            description="This is a new agent",
            setting_id=str(self.test_setting.id),
            public=True
        )
        
        self.assertIsNotNone(new_agent)
        self.assertEqual(new_agent.name, "New Agent")
        self.assertEqual(new_agent.description, "This is a new agent")
        self.assertTrue(new_agent.public)
        self.assertEqual(str(new_agent.setting_id), str(self.test_setting.id))
        
    # def test_update(self):
    #     # Test updating an agent
    #     updated_agent = self.agent_repo.update(
    #         str(self.test_agent.id),
    #         {
    #             "name": "Updated Agent",
    #             "description": "This is an updated agent",
    #             "public": True
    #         }
    #     )
        
    #     self.assertIsNotNone(updated_agent)
    #     self.assertEqual(updated_agent.name, "Updated Agent")
    #     self.assertEqual(updated_agent.description, "This is an updated agent")
    #     self.assertTrue(updated_agent.public)
        
    #     # Verify slug was updated when name changed
    #     self.assertIn("updated-agent", updated_agent.slug)
        
    # def test_delete(self):
    #     # Test deleting an agent
    #     result = self.agent_repo.delete(str(self.test_agent.id))
        
    #     self.assertTrue(result)
        
    #     # Verify agent was deleted
    #     agent = self.agent_repo.get_by_id(str(self.test_agent.id))
    #     self.assertIsNone(agent)
        
    # def test_get_by_setting_id(self):
    #     # Create another agent with the same setting
    #     self.agent_repo.create(
    #         name="Another Agent",
    #         description="This is another test agent",
    #         setting_id=str(self.test_setting.id),
    #         public=True
    #     )
        
    #     # Test getting agents by setting ID
    #     agents = self.agent_repo.get_by_setting_id(str(self.test_setting.id))
        
    #     self.assertGreaterEqual(len(agents), 2)
        
    # def test_get_public_agents(self):
    #     # Create a public agent
    #     self.agent_repo.create(
    #         name="Public Agent",
    #         description="This is a public agent",
    #         setting_id=str(self.test_setting.id),
    #         public=True
    #     )
        
    #     # Test getting public agents
    #     public_agents = self.agent_repo.get_public_agents()
        
    #     self.assertGreaterEqual(len(public_agents), 1)


if __name__ == '__main__':
    unittest.main()
