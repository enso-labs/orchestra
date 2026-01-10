# Skill: Acceptance Criteria Extraction

## Purpose
Extract and infer testable acceptance criteria from all evidence sources.

## Inputs
- [ ] Test files and changes
- [ ] Documentation acceptance criteria sections
- [ ] Commit messages with success conditions
- [ ] Code behavioral patterns

## Outputs
- [ ] List of testable acceptance criteria
- [ ] Source for each criterion (explicit vs inferred)
- [ ] Test coverage map
- [ ] Missing test scenarios

## Execution Checklist

1. [ ] Extract explicit acceptance criteria from docs
   ```bash
   git diff <range> -- "*.md" | grep -A 5 -iE "acceptance|criteria|success|must be able"
   ```

2. [ ] Analyze test file changes
   ```bash
   git diff <range> -- "*.test.*" "*.spec.*" "test_*"
   ```

3. [ ] Parse test structure
   - Test suite names (`describe`, `context`)
   - Test case names (`it`, `test`, `def test_`)
   - Assertions (`expect`, `assert`, `should`)
   - Setup/teardown (what state is required)

4. [ ] Extract criteria patterns
   - **Explicit docs**: "Must be able to...", "Should support..."
   - **Test names**: `test_user_can_login_with_valid_credentials`
   - **Assertions**: `expect(response.status).toBe(200)`
   - **Given/When/Then**: Behavior specifications

5. [ ] Infer missing criteria from code
   - New API endpoints → "API responds to [method] [path]"
   - New validation → "System rejects invalid [input]"
   - New error handling → "System handles [error case]"
   - New state changes → "State transitions to [new state]"

6. [ ] Map criteria to code changes
   ```
   Criterion: User can authenticate with username/password
   - Doc: PROPOSAL.md:L67 ✓
   - Test: auth.test.ts:L23 ✓
   - Code: auth.service.ts:L45 ✓
   Coverage: FULL
   ```

7. [ ] Identify missing test coverage
   - Code changes without tests
   - Doc criteria without tests
   - Edge cases not tested

8. [ ] Format output
   ```markdown
   ## Acceptance Criteria

   ### From Documentation (Explicit)
   - [ ] User can authenticate with username/password
     - Source: PROPOSAL.md:L67
     - Test: auth.test.ts:L23 ✓
     - Confidence: High

   - [ ] System returns JWT access token on successful auth
     - Source: PROPOSAL.md:L68
     - Test: auth.test.ts:L45 ✓
     - Confidence: High

   ### From Tests (Explicit)
   - [ ] Protected routes reject requests without valid token
     - Source: middleware.test.ts:L89
     - Test: middleware.test.ts:L89 ✓
     - Confidence: High

   ### Inferred from Code (Implicit)
   - [ ] System validates token expiry time
     - Source: Inferred from jwt.service.ts:L34
     - Test: MISSING
     - Confidence: Medium

   - [ ] System handles invalid token format gracefully
     - Source: Inferred from error handling in auth.ts:L56
     - Test: MISSING
     - Confidence: Low

   ## Coverage Summary
   - Total Criteria: 5
   - Tested: 3 (60%)
   - Untested: 2 (40%)

   ## Missing Test Scenarios
   1. Token expiry validation
   2. Invalid token format handling
   3. Token refresh flow edge cases
   ```

## Failure Signals

- **No tests in diff** → Rely on doc criteria and code inference
- **Tests but no assertions** → Possible incomplete tests
- **All criteria inferred** → Need explicit requirements
- **No criteria extracted** → Re-check evidence sources

## Quality Gates

- [ ] At least one criterion extracted per major code change
- [ ] Each criterion marked as explicit or inferred
- [ ] Test coverage status indicated (tested/untested)
- [ ] Confidence level assigned
- [ ] Missing test scenarios identified
- [ ] Criteria are testable (specific, measurable)

## Test Pattern Recognition

### JavaScript/TypeScript (Jest/Vitest)
```javascript
describe('Authentication', () => {
  it('should return JWT token for valid credentials', async () => {
    const response = await auth.login('user', 'pass');
    expect(response.token).toBeDefined();
    expect(response.token).toMatch(/^eyJ/);
  });
});
```
**Criterion**: System returns JWT token for valid credentials

### Python (pytest)
```python
def test_user_can_login_with_valid_credentials():
    response = client.post("/auth/login", json={"username": "user", "password": "pass"})
    assert response.status_code == 200
    assert "token" in response.json()
```
**Criterion**: User can login with valid credentials, receives token

### Gherkin (BDD)
```gherkin
Scenario: User authenticates with valid credentials
  Given a user with username "test" and password "pass123"
  When the user submits login credentials
  Then the system returns a JWT token
  And the token is valid for 1 hour
```
**Criteria**: Multiple from Given/When/Then steps

## Criterion Quality Checklist

Each acceptance criterion should be:

- [ ] **Specific**: Clear what is being tested
- [ ] **Measurable**: Can verify pass/fail
- [ ] **Achievable**: Technically feasible
- [ ] **Relevant**: Related to the change
- [ ] **Testable**: Can write automated test

**Good Example**:
```
✓ User can authenticate with username/password and receive JWT token
```

**Bad Example**:
```
✗ Authentication works properly
(Too vague, not measurable)
```

## Coverage Map Template

```markdown
| Criterion | Doc | Test | Code | Status |
|-----------|-----|------|------|--------|
| User can login with valid credentials | ✓ | ✓ | ✓ | COVERED |
| System rejects invalid credentials | ✓ | ✓ | ✓ | COVERED |
| Token expires after 1 hour | ✓ | ✗ | ✓ | NEEDS_TEST |
| System handles expired tokens | - | ✗ | ✓ | INFERRED |
```

## Inference Patterns

### From API Routes
```typescript
router.post('/auth/login', authController.login)
```
**Inferred Criterion**: API accepts POST requests to /auth/login

### From Validation
```typescript
if (!username || !password) {
  throw new ValidationError('Username and password required');
}
```
**Inferred Criterion**: System rejects login requests without username or password

### From Error Handling
```typescript
try {
  await validateToken(token);
} catch (TokenExpiredError) {
  return res.status(401).json({ error: 'Token expired' });
}
```
**Inferred Criterion**: System returns 401 for expired tokens

### From State Changes
```typescript
user.lastLoginAt = new Date();
await user.save();
```
**Inferred Criterion**: System updates user's last login timestamp
