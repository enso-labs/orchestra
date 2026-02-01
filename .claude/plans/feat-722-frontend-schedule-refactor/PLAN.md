# Context: 

### React Big Calendar should be used to display schedules 30 days in past AND 30 days in future from today.

### Diff from Backend PR
https://patch-diff.githubusercontent.com/raw/ruska-ai/orchestra/pull/721.diff

### Libraries to Consider
- [React Big Calendar](https://github.com/jquense/react-big-calendar?tab=readme-ov-file#react-big-calendar) | Would be nice to display schedules 30 days in past AND 30 days in future from today in the calendar. Blue would indicate "scheduled", Green "success", and Red indicate a run "failure". When clicking on the event in the calendar would open in new tab that thread from the schedule.
- If schedule is recurring we can just show a single event and a list of the schedules past and coming up if we have the data. 

### Workflow
1. Study the screenshots in `.claude/plans/feat-722-frontend-schedule-refactor/images` folder.
    - These will show how to create a scheduled agent from the interface with the `agent-browser` skill.
    - Study the "Create New Schedule" modal.
2. Our goal is to move the navigation from the `SettingsPopover` and have a spot in the app-sidebar like we do with Projects, Assistants, and Threads. We should in the drop down have the last 10 schedules that have occurred in the sidebar. The index page (Calendar) will be place for management. We need to think hard about this design. Use the `agent-browser` kill when necessary to validate changes.
3. Calendar is the DEFAULT view. We should have a table descending as secondary view with ability to toggle between PAST and FUTURE schedules so we can get an idea of what HAS been executed and what WILL be executed in table view.

# Goal:

**TDD Refactor the Schedules feature from a settings-level action to a first-class navigation entity with a dedicated management interface.**

## Deliverables:

1. **Sidebar Integration**
   - Add "Schedules" section to `app-sidebar` alongside Projects, Assistants, and Threads
   - Display the 10 most recent schedule executions in the sidebar dropdown
   - Each item should show schedule name, status indicator (🔵 scheduled / 🟢 success / 🔴 failure), and relative timestamp

2. **Calendar View (Default)**
   - Implement React Big Calendar as the primary `/schedules` index page
   - Display events spanning 30 days past to 30 days future from today
   - Color-code events: Blue (scheduled), Green (success), Red (failure)
   - Clicking an event opens the associated thread in a new tab
   - For recurring schedules, show a single consolidated event with expandable list of past/upcoming occurrences

3. **Table View (Secondary)**
   - Add toggle to switch between Calendar and Table views
   - Table should support toggling between PAST and FUTURE schedules
   - Sort descending by execution time
   - Include columns: Schedule Name, Status, Agent/Skill, Last Run, Next Run, Actions

4. **Navigation Cleanup**
   - Remove schedule navigation/creation from `SettingsPopover`
   - Ensure "Create New Schedule" modal remains accessible from the new Schedules section

5. **Validation**
   - Use `agent-browser` skill to validate UI changes match the reference screenshots
   - Ensure the `agent-browser` skill scheduling flow works end-to-end with new navigation

