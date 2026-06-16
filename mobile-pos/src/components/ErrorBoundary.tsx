import React from "react";

import { Pressable, Text, View } from "react-native";



type State = { error: Error | null };



export class ErrorBoundary extends React.Component<

  { children: React.ReactNode },

  State

> {

  state: State = { error: null };



  static getDerivedStateFromError(error: Error): State {

    return { error };

  }



  render() {

    if (this.state.error) {

      return (

        <View className="flex-1 items-center justify-center bg-slate-50 px-6">

          <Text className="mb-2 text-lg font-bold text-slate-900">Something went wrong</Text>

          <Text className="mb-6 text-center text-sm text-slate-600">{this.state.error.message}</Text>

          <Pressable

            onPress={() => this.setState({ error: null })}

            className="rounded-xl bg-indigo-600 px-5 py-3"

          >

            <Text className="font-semibold text-white">Try again</Text>

          </Pressable>

        </View>

      );

    }

    return this.props.children;

  }

}


