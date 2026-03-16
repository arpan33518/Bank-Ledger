import { Show, SignInButton, UserButton, useUser } from '@clerk/react'
import { useEffect } from 'react'
import axios from 'axios'

function App() {
  const { isSignedIn, user } = useUser();

  // Send welcome email once when user signs in
  useEffect(() => {
    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      const name = user.firstName || "User";
      const alreadySent = localStorage.getItem(`welcome_sent_${user.id}`);

      if (email && !alreadySent) {
        axios.post("http://localhost:5000/api/email/send-welcome", {
          email,
          name,
          clerkId: user.id    // ← send Clerk ID so backend can save user to MongoDB
        })

          .then(() => {
            console.log("Welcome email sent!");
            localStorage.setItem(`welcome_sent_${user.id}`, "true");
          })
          .catch(err => console.error("Failed to send welcome email:", err));
      }
    }
  }, [isSignedIn, user]);

  return (
    <>
      <header>
        <Show when="signed-out">
          <SignInButton />

        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>
      {/* <p>{message}</p> */}
    </>
  )
}

export default App