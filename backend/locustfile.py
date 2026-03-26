"""
Locust load test — SchoolPro API
=================================
Validates that the system handles 100+ concurrent users with sub-2s responses.

Usage:
    # Install: pip install locust
    # Run headless (CI):
    locust --headless -u 100 -r 10 --run-time 60s \
        --host http://127.0.0.1:8000 \
        --csv=results/loadtest

    # Run with web UI:
    locust --host http://127.0.0.1:8000

Configuration via environment variables:
    LOAD_TEST_ADMIN_USER  (default: admin@schoolpro.com)
    LOAD_TEST_ADMIN_PASS  (default: admin123)
    LOAD_TEST_TEACHER_USER (default: teacher@schoolpro.com)
    LOAD_TEST_TEACHER_PASS (default: teacher123)
"""
import os
import random
from locust import HttpUser, task, between, events


# ── Credentials (override via env in CI) ─────────────────────────────────────
ADMIN_CREDS  = {
    'email': os.environ.get('LOAD_TEST_ADMIN_USER', 'admin@schoolpro.com'),
    'password': os.environ.get('LOAD_TEST_ADMIN_PASS', 'admin123'),
}
TEACHER_CREDS = {
    'email': os.environ.get('LOAD_TEST_TEACHER_USER', 'teacher@schoolpro.com'),
    'password': os.environ.get('LOAD_TEST_TEACHER_PASS', 'teacher123'),
}

# Shared token cache — populated during on_start
_token_cache: dict[str, str] = {}


def _get_token(client, creds: dict) -> str:
    """Authenticate and return access token. Cached per credential set."""
    key = creds['email']
    if key in _token_cache:
        return _token_cache[key]
    with client.post(
        '/api/auth/login/',
        json=creds,
        catch_response=True,
        name='[auth] login',
    ) as resp:
        if resp.status_code == 200:
            token = resp.json().get('access', '')
            _token_cache[key] = token
            return token
        resp.failure(f'Login failed: {resp.status_code}')
        return ''


# ── Admin user behavior ───────────────────────────────────────────────────────

class AdminUser(HttpUser):
    """Simulates a Director/Admin checking dashboards and student data."""
    weight = 20          # 20% of virtual users are admins
    wait_time = between(1, 3)

    def on_start(self):
        token = _get_token(self.client, ADMIN_CREDS)
        self.headers = {'Authorization': f'Bearer {token}'} if token else {}
        # Cache a class ID for later tasks
        self._classe_id = None
        self._student_id = None

    @task(3)
    def dashboard_stats(self):
        with self.client.get(
            '/api/reports/dashboard/',
            headers=self.headers,
            catch_response=True,
            name='[admin] dashboard stats',
        ) as r:
            if r.status_code not in (200, 304):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(4)
    def student_list(self):
        with self.client.get(
            '/api/students/?page_size=50',
            headers=self.headers,
            catch_response=True,
            name='[admin] student list',
        ) as r:
            if r.status_code == 200:
                data = r.json()
                results = data.get('results', data) if isinstance(data, dict) else data
                if results:
                    self._student_id = random.choice(results)['id']
            else:
                r.failure(f'Expected 200, got {r.status_code}')

    @task(2)
    def classes_list(self):
        with self.client.get(
            '/api/classes/',
            headers=self.headers,
            catch_response=True,
            name='[admin] classes list',
        ) as r:
            if r.status_code == 200:
                data = r.json()
                results = data.get('results', data) if isinstance(data, dict) else data
                if results:
                    self._classe_id = random.choice(results)['id']
            else:
                r.failure(f'Expected 200, got {r.status_code}')

    @task(2)
    def class_summary(self):
        if not self._classe_id:
            return
        with self.client.get(
            f'/api/students/class_summary/?classe_id={self._classe_id}',
            headers=self.headers,
            catch_response=True,
            name='[admin] class summary',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(2)
    def payment_list(self):
        with self.client.get(
            '/api/payments/?page_size=30',
            headers=self.headers,
            catch_response=True,
            name='[admin] payment list',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(1)
    def attendance_today(self):
        with self.client.get(
            '/api/attendance/today/',
            headers=self.headers,
            catch_response=True,
            name='[admin] attendance today',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(1)
    def student_detail(self):
        if not self._student_id:
            return
        with self.client.get(
            f'/api/students/{self._student_id}/situation/',
            headers=self.headers,
            catch_response=True,
            name='[admin] student situation',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(1)
    def health_check(self):
        with self.client.get(
            '/api/health/',
            catch_response=True,
            name='[sys] health check',
        ) as r:
            if r.status_code not in (200, 503):
                r.failure(f'Unexpected status: {r.status_code}')


# ── Teacher user behavior ─────────────────────────────────────────────────────

class TeacherUser(HttpUser):
    """Simulates a teacher checking grades and entering lesson logs."""
    weight = 60          # 60% of virtual users are teachers
    wait_time = between(2, 5)

    def on_start(self):
        token = _get_token(self.client, TEACHER_CREDS)
        self.headers = {'Authorization': f'Bearer {token}'} if token else {}
        self._subject_id = None

    @task(4)
    def teacher_dashboard(self):
        with self.client.get(
            '/api/teachers/dashboard_stats/',
            headers=self.headers,
            catch_response=True,
            name='[teacher] dashboard stats',
        ) as r:
            if r.status_code not in (200, 403):
                r.failure(f'Expected 200/403, got {r.status_code}')

    @task(5)
    def grades_list(self):
        with self.client.get(
            '/api/grades/?page_size=50',
            headers=self.headers,
            catch_response=True,
            name='[teacher] grades list',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(3)
    def lesson_logs(self):
        with self.client.get(
            '/api/teachers/lesson-logs/?ordering=-date&page_size=20',
            headers=self.headers,
            catch_response=True,
            name='[teacher] lesson logs',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(2)
    def subject_list(self):
        with self.client.get(
            '/api/subjects/',
            headers=self.headers,
            catch_response=True,
            name='[teacher] subject list',
        ) as r:
            if r.status_code == 200:
                data = r.json()
                results = data.get('results', data) if isinstance(data, dict) else data
                if results:
                    self._subject_id = random.choice(results)['id']
            else:
                r.failure(f'Expected 200, got {r.status_code}')


# ── Agent / Receptionist behavior ────────────────────────────────────────────

class AgentUser(HttpUser):
    """Simulates an agent scanning QR codes at the gate."""
    weight = 20          # 20% of virtual users are agents
    wait_time = between(3, 8)

    def on_start(self):
        # Agents use the same admin credentials in this test
        token = _get_token(self.client, ADMIN_CREDS)
        self.headers = {'Authorization': f'Bearer {token}'} if token else {}

    @task(5)
    def attendance_today(self):
        with self.client.get(
            '/api/attendance/today/',
            headers=self.headers,
            catch_response=True,
            name='[agent] attendance today',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(3)
    def attendance_stats(self):
        with self.client.get(
            '/api/attendance/stats/',
            headers=self.headers,
            catch_response=True,
            name='[agent] attendance stats',
        ) as r:
            if r.status_code not in (200,):
                r.failure(f'Expected 200, got {r.status_code}')

    @task(1)
    def health_check(self):
        with self.client.get(
            '/api/health/',
            catch_response=True,
            name='[sys] health check',
        ) as r:
            if r.status_code not in (200, 503):
                r.failure(f'Unexpected status: {r.status_code}')


# ── Pass/Fail thresholds ──────────────────────────────────────────────────────

@events.quitting.add_listener
def assert_thresholds(environment, **kwargs):
    """Fail the test run if SLA thresholds are breached."""
    stats = environment.stats.total

    # 95th-percentile response time must be < 2000 ms
    p95 = stats.get_response_time_percentile(0.95)
    if p95 and p95 > 2000:
        print(f"\n❌ FAIL: P95 response time {p95:.0f}ms > 2000ms threshold")
        environment.process_exit_code = 1

    # Failure rate must be < 1%
    fail_ratio = stats.fail_ratio
    if fail_ratio > 0.01:
        print(f"\n❌ FAIL: Error rate {fail_ratio:.1%} > 1% threshold")
        environment.process_exit_code = 1

    if environment.process_exit_code == 0:
        print(f"\n✅ PASS: P95={p95:.0f}ms, errors={fail_ratio:.2%}, "
              f"RPS={stats.current_rps:.1f}")
