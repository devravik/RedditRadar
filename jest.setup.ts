// Silence console.error in tests unless debugging
jest.spyOn(console, 'error').mockImplementation(() => {})
