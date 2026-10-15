/**
 * MODUL AUTENTIKASI ADMIN DESA MEKARSARI
 * Mendukung Firebase Auth + Automatic Demo Mode untuk GitHub Pages
 */

const ADMIN_SESSION_KEY = 'mekarsari_admin_session';

// Konfigurasi Firebase diambil dari assets/js/firebase-config.js
// (file itu harus dimuat SEBELUM admin-auth.js)
const firebaseConfig = window.FIREBASE_CONFIG || {};

class AdminAuth {
  constructor() {
    this.isFirebaseReady = false;
    this.init();
  }

  init() {
    // Memeriksa ketersediaan Firebase SDK
    var hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;
    if (typeof firebase !== 'undefined' && firebase.apps && typeof firebase.auth === 'function' && hasConfig) {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      this.isFirebaseReady = true;
    }
  }

  /**
   * Memeriksa status login saat halaman dimuat
   */
  checkAuthGuard(isLoginPage = false) {
    const session = this.getSession();

    // Mode Firebase: sesi hanya sah jika Firebase Auth benar-benar punya user login.
    // Sesi demo lama (tanpa user Firebase) otomatis dikembalikan ke halaman login.
    if (this.isFirebaseReady) {
      firebase.auth().onAuthStateChanged((user) => {
        if (isLoginPage) {
          if (user && this.getSession()) window.location.href = 'index.html';
        } else if (!user) {
          localStorage.removeItem(ADMIN_SESSION_KEY);
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          window.location.href = 'login.html';
        }
      });
      return;
    }

    if (isLoginPage) {
      if (session) {
        window.location.href = 'index.html';
      }
    } else {
      if (!session) {
        window.location.href = 'login.html';
      }
    }
  }

  /**
   * Melakukan Login Admin
   */
  async login(identifier, password, remember = false) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Logika Autentikasi Produksi (Firebase) atau Fallback Demo
        if (this.isFirebaseReady) {
          firebase.auth().signInWithEmailAndPassword(identifier, password)
            .then((userCredential) => {
              const userData = {
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                name: "Admin Desa",
                role: "Petugas Desa"
              };
              this.saveSession(userData, remember);
              resolve({ success: true, user: userData });
            })
            .catch((error) => {
              reject(new Error("Email atau password tidak sesuai."));
            });
        } else if (firebaseConfig.projectId) {
          // Config Firebase ada, tetapi SDK-nya tidak termuat: jangan pakai mode demo.
          reject(new Error("Firebase belum termuat. Pastikan script firebase-app-compat, firebase-auth-compat, dan firebase-config.js ada sebelum admin-auth.js."));
        } else {
          // Fallback DEMO Mode (Validasi sederhana jika backend/Firebase belum dikonfigurasi)
          if ((identifier === 'admin@mekarsari.desa.id' || identifier === 'admin') && password === 'admin123') {
            const demoUser = {
              uid: 'demo-admin-01',
              email: 'admin@mekarsari.desa.id',
              name: 'Petugas Desa',
              role: 'Administrator Desa'
            };
            this.saveSession(demoUser, remember);
            resolve({ success: true, user: demoUser });
          } else {
            reject(new Error("Kredensial tidak valid. Gunakan 'admin' & 'admin123' untuk mode demo."));
          }
        }
      }, 800); // Simulasi delay jaringan
    });
  }

  /**
   * Menyimpan Sesi Login
   */
  saveSession(userData, remember) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      ...userData,
      loginAt: new Date().toISOString()
    }));
  }

  /**
   * Mendapatkan Data Sesi
   */
  getSession() {
    const local = localStorage.getItem(ADMIN_SESSION_KEY);
    const session = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return local ? JSON.parse(local) : (session ? JSON.parse(session) : null);
  }

  /**
   * Melakukan Logout
   */
  logout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    const goLogin = () => { window.location.href = 'login.html'; };
    if (this.isFirebaseReady) {
      // Tunggu signOut selesai sebelum pindah halaman
      firebase.auth().signOut().then(goLogin, goLogin);
    } else {
      goLogin();
    }
  }
}

// Global Auth Instance
window.adminAuth = new AdminAuth();