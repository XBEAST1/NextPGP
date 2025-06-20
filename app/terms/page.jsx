"use client";

import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const TermsPage = () => {
  return (
    <div className="bg-black text-white flex flex-col items-center">
      <div className="max-w-3xl w-full p-6">
        <motion.h1
          {...fadeInUp}
          className="text-3xl font-bold mb-6 text-center"
        >
          Terms of Service
        </motion.h1>

        <motion.div {...fadeInUp} className="space-y-4 text-sm md:text-base">
          <p>Effective Date: June 20, 2025</p>

          <p>
            By using NextPGP, you agree to the following terms. Please read them
            carefully.
          </p>

          <ul className="list-disc pl-5 space-y-2">
            <li>
              You are solely responsible for managing, backing up, and
              protecting your encryption keys.
            </li>
            <li>
              NextPGP provides its encryption services “as is” without
              warranties of any kind.
            </li>
            <li>
              We are not liable for data loss, unauthorized access, or any
              damages resulting from use or misuse of the app.
            </li>
            <li>
              You agree to use this app only for lawful purposes and in
              compliance with all applicable laws.
            </li>
            <li>
              OTPs sent via Gmail are for verifying critical actions like vault
              deletion. We do not store or access your email data.
            </li>
            <li>
              We reserve the right to update these terms without notice.
              Continued use of the app implies acceptance of any changes.
            </li>
          </ul>

          <p>
            For any legal inquiries or concerns, contact us at{" "}
            <a
              href="mailto:xbeast331@proton.me"
              className="text-blue-400 underline"
            >
              xbeast331@proton.me
            </a>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default TermsPage;