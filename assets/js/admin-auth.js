
/**
 * AUTENTIKASI Admin Desa MEKARSARI
 * Memerlukan Firebase Compat SDK dan firebase-config.js
 * yang dimuat sebelum file ini.
 */

const ADMIN_SESSION_KEY = 'mekarsari_admin_session';
const firebaseConfig = window.FIREBASE_CONFIG || {};

class AdminAuth {
  constructor() {
    this.isFirebaseReady = false;
    this.init();
  }

  init() {
    const hasConfig = Boolean(
      firebaseConfig.apiKey && firebaseConfig.projectId
    );

    if (
      typeof firebase === 'undefined' ||
      !firebase.apps ||
      typeof firebase.auth !== 'function' ||
      !hasConfig
    ) {
      console.error('[AdminAuth] Firebase belum siap.');
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    this.isFirebaseReady = true;
  }

  clearSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }

  getSession() {
    try {
      const raw =
        localStorage.getItem(ADMIN_SESSION_KEY) ||
        sessionStorage.getItem(ADMIN_SESSION_KEY);

      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      this.clearSession();
      return null;
    }
  }

  saveSession(userData, remember) {
    this.clearSession();

    const storage = remember ? localStorage : sessionStorage;

    storage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({
        uid: userData.uid,
        email: userData.email || '',
        name: userData.name || 'Rusdiman, S.Pd., M.AP.',
        role: userData.role || 'Kepala Seksi Pelayanan',
        loginAt: new Date().toISOString()
      })
    );
  }

  async verifyAdmin(user) {
  if (!this.isFirebaseReady || !user || !user.uid) {
    return false;
  }

  const db = firebase.firestore();
  const docRef = db.collection('admins').doc(user.uid);
  const snap = await docRef.get();

  console.log('[AdminAuth] Project ID:', firebase.app().options.projectId);
  console.log('[AdminAuth] UID login:', user.uid);
  console.log('[AdminAuth] Dokumen admin ditemukan:', snap.exists);

  return snap.exists;
}

  checkAuthGuard(isLoginPage = false) {
    if (!this.isFirebaseReady) {
      this.clearSession();

      if (!isLoginPage) {
        window.location.replace('login.html');
      }

      return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      const session = this.getSession();

      if (!user) {
        this.clearSession();

        if (!isLoginPage) {
          window.location.replace('login.html');
        }

        return;
      }

      const validSession = Boolean(
        session && session.uid === user.uid
      );

      const isAdmin =
        validSession && await this.verifyAdmin(user);

      if (isLoginPage) {
        if (isAdmin) {
          window.location.replace('index.html');
        } else {
          this.clearSession();
        }

        return;
      }

      if (!isAdmin) {
        this.clearSession();

        try {
          await firebase.auth().signOut();
        } catch (error) {
          console.error('[AdminAuth] Sign out gagal:', error);
        }

        window.location.replace('login.html');
      }
    });
  }

  async login(email, password, remember = false) {
    if (!this.isFirebaseReady) {
      throw new Error(
        'Firebase belum siap. Periksa Firebase SDK dan konfigurasi.'
      );
    }

    try {
      const persistence = remember
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;

      await firebase.auth().setPersistence(persistence);

      const credential = await firebase
        .auth()
        .signInWithEmailAndPassword(email, password);

      const user = credential.user;

      if (!await this.verifyAdmin(user)) {
        this.clearSession();
        await firebase.auth().signOut();

        throw new Error(
          'Akun ini belum terdaftar sebagai admin.'
        );
      }

      const userData = {
        uid: user.uid,
        email: user.email || email,
        name: 'Rusdiman, S.Pd., M.AP.',
        role: 'Kepala Seksi Pelayanan'
      };

      this.saveSession(userData, remember);

      return {
        success: true,
        user: userData
      };
    } catch (error) {
      if (
        error.message &&
        error.message.includes('belum terdaftar sebagai admin')
      ) {
        throw error;
      }

      console.error('[AdminAuth] Login gagal:', error);

      if (
        error.code === 'auth/invalid-email' ||
        error.code === 'auth/user-disabled' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        throw new Error('Email atau password tidak sesuai.');
      }

      if (error.code === 'permission-denied') {
        throw new Error(
          'Hak admin tidak dapat diperiksa. Periksa Firestore Rules.'
        );
      }

      throw new Error(
        error.message || 'Login gagal. Silakan coba lagi.'
      );
    }
  }

  async logout() {
    this.clearSession();

    if (this.isFirebaseReady) {
      try {
        await firebase.auth().signOut();
      } catch (error) {
        console.error('[AdminAuth] Logout gagal:', error);

        throw new Error(
          'Logout Firebase gagal. Periksa koneksi lalu coba lagi.'
        );
      }
    }

    window.location.replace('login.html');
  }
}

window.adminAuth = new AdminAuth();
