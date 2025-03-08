import uuid
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session

from src.models import Agent, AgentRevision, Settings
from src.repos.agent_repo import AgentRepo

# Test data
TEST_USER_ID = str(uuid.uuid4())
TEST_AGENT_ID = str(uuid.uuid4())
TEST_SETTINGS_ID = str(uuid.uuid4())
TEST_REVISION_ID = str(uuid.uuid4())

@pytest.fixture
def mock_db():
    """Create a mock database session."""
    return MagicMock(spec=Session)

@pytest.fixture
def agent_repo(mock_db):
    """Create an agent repository with the mock database."""
    return AgentRepo(db=mock_db, user_id=TEST_USER_ID)

def test_get_by_id(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    # Act
    result = agent_repo.get_by_id(TEST_AGENT_ID)
    
    # Assert
    mock_db.query.assert_called_once_with(Agent)
    mock_db.query.return_value.filter.assert_called_once()
    assert result == mock_agent

def test_get_by_slug(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    # Act
    result = agent_repo.get_by_slug("test-agent")
    
    # Assert
    mock_db.query.assert_called_once_with(Agent)
    mock_db.query.return_value.filter.assert_called_once()
    assert result == mock_agent

def test_get_all(agent_repo, mock_db):
    # Arrange
    mock_agents = [MagicMock(spec=Agent), MagicMock(spec=Agent)]
    mock_db.query.return_value.filter.return_value.all.return_value = mock_agents
    
    # Act
    result = agent_repo.get_all()
    
    # Assert
    mock_db.query.assert_called_once_with(Agent)
    mock_db.query.return_value.filter.assert_called_once()
    assert result == mock_agents

def test_get_public(agent_repo, mock_db):
    # Arrange
    mock_agents = [MagicMock(spec=Agent), MagicMock(spec=Agent)]
    mock_db.query.return_value.filter.return_value.all.return_value = mock_agents
    
    # Act
    result = agent_repo.get_public()
    
    # Assert
    mock_db.query.assert_called_once_with(Agent)
    assert result == mock_agents

def test_create(agent_repo, mock_db):
    # Arrange
    mock_db.commit = MagicMock()
    mock_db.refresh = MagicMock()
    
    # Act
    result = agent_repo.create("Test Agent", "Test Description", "private")
    
    # Assert
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once()
    assert isinstance(result, Agent)
    assert result.name == "Test Agent"
    assert result.description == "Test Description"
    assert result.visibility == "private"
    assert result.user_id == TEST_USER_ID

def test_update(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_agent.user_id = uuid.UUID(TEST_USER_ID)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    # Act
    result = agent_repo.update(TEST_AGENT_ID, {"name": "Updated Agent", "visibility": "public"})
    
    # Assert
    assert mock_agent.name == "Updated Agent"
    assert mock_agent.visibility == "public"
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once_with(mock_agent)
    assert result == mock_agent

def test_update_not_owner(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_agent.user_id = uuid.uuid4()  # Different from TEST_USER_ID
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    # Act
    result = agent_repo.update(TEST_AGENT_ID, {"name": "Updated Agent"})
    
    # Assert
    assert result is None
    mock_db.commit.assert_not_called()

def test_delete(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_agent.user_id = uuid.UUID(TEST_USER_ID)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    # Act
    result = agent_repo.delete(TEST_AGENT_ID)
    
    # Assert
    mock_db.delete.assert_called_once_with(mock_agent)
    mock_db.commit.assert_called_once()
    assert result is True

def test_delete_not_owner(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_agent.user_id = uuid.uuid4()  # Different from TEST_USER_ID
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    # Act
    result = agent_repo.delete(TEST_AGENT_ID)
    
    # Assert
    mock_db.delete.assert_not_called()
    mock_db.commit.assert_not_called()
    assert result is False

def test_create_revision(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_agent.user_id = uuid.UUID(TEST_USER_ID)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    # For the version number query
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    
    # Act
    result = agent_repo.create_revision(TEST_AGENT_ID, TEST_SETTINGS_ID, "First Revision", "Initial version")
    
    # Assert
    mock_db.add.assert_called_once()
    assert mock_agent.current_revision_id == result.id
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once()
    assert isinstance(result, AgentRevision)
    assert result.agent_id == TEST_AGENT_ID
    assert result.settings_id == TEST_SETTINGS_ID
    assert result.version_number == 1
    assert result.revision_name == "First Revision"
    assert result.change_notes == "Initial version"

def test_get_revisions(agent_repo, mock_db):
    # Arrange
    mock_agent = MagicMock(spec=Agent)
    mock_agent.user_id = uuid.UUID(TEST_USER_ID)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_agent
    
    mock_revisions = [MagicMock(spec=AgentRevision), MagicMock(spec=AgentRevision)]
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_revisions
    
    # Act
    result = agent_repo.get_revisions(TEST_AGENT_ID)
    
    # Assert
    assert result == mock_revisions

def test_set_current_revision(agent_repo, mock_db):
    # Arrange
    # Create mock objects
    mock_agent = MagicMock(spec=Agent)
    mock_agent.user_id = uuid.UUID(TEST_USER_ID)
    
    mock_revision = MagicMock(spec=AgentRevision)
    mock_revision.agent_id = TEST_AGENT_ID
    
    # Set up the first query chain - for the initial get_by_id call
    mock_query1 = MagicMock()
    mock_filter1 = MagicMock()
    mock_filter1.first.return_value = mock_agent
    mock_query1.filter.return_value = mock_filter1
    
    # Set up the second query chain - for the get_revision call
    mock_query2 = MagicMock()
    mock_filter2 = MagicMock()
    mock_filter2.first.return_value = mock_revision
    mock_query2.filter.return_value = mock_filter2
    
    # Set up the third query chain - for the second get_by_id call inside get_revision
    mock_query3 = MagicMock()
    mock_filter3 = MagicMock()
    mock_filter3.first.return_value = mock_agent
    mock_query3.filter.return_value = mock_filter3
    
    # Configure the mock_db.query to return different query objects
    mock_db.query.side_effect = [mock_query1, mock_query2, mock_query3]
    
    # Act
    result = agent_repo.set_current_revision(TEST_AGENT_ID, TEST_REVISION_ID)
    
    # Assert
    assert mock_agent.current_revision_id == TEST_REVISION_ID
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once_with(mock_agent)
    assert result == mock_agent 