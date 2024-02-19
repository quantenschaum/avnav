# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py 
###############################################################################
import traceback

import serial
import socket
import os
import time

from avnserial import *
from avnav_worker import *
hasSerial=False

try:
  import avnserial
  hasSerial=True
except:
  pass


import avnav_handlerList


class NmeaEntry(object):
  def __init__(self,data,source=None,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    self.data=data
    self.source=source
    self.omitDecode=omitDecode
    self.sourcePriority=sourcePriority


#a Worker for feeding data trough gpsd (or directly to the navdata)
class AVNFeeder(AVNWorker):
  
  @classmethod
  def getConfigParam(cls, child=None):
    return {'maxList': 300,      #len of the input list
            'feederSleep': 0.5,  #time in s the feeder will sleep if there is no data
            'name': '',           #if there should be more then one reader we must set the name
            'decoderFilter':''   #a filter experession for the decoder
            }

  @classmethod
  def getStartupGroup(cls):
    return 1

  @classmethod
  def autoInstantiate(cls):
    return True

  def __init__(self,cfgparam):
    super().__init__(cfgparam)
    self.type=AVNWorker.Type.FEEDER
    self.listlock=threading.Condition()
    self.history=[]
    self.sequence=0
    self.readConfig()

  def readConfig(self):
    self.maxlist = self.getIntParam('maxList', True)
    self.waitTime = self.getFloatParam('feederSleep')
    filterstr = self.getStringParam('decoderFilter') or ''
    self.nmeaFilter = filterstr.split(",")

  def stop(self):
    super().stop()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()



  def addNMEA(self, entry,source=None,addCheckSum=False,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    """
    add an NMEA record to our internal queue
    @param entry: the record
    @param source: the source where the record comes from
    @param addCheckSum: add the NMEA checksum
    @return:
    """
    if len(entry) < 5:
      AVNLog.debug("addNMEA: ignoring short data %s",entry)
      return False
    if addCheckSum:
      entry= entry.replace("\r","").replace("\n","")
      entry+= "*" + NMEAParser.nmeaChecksum(entry) + "\r\n"
    else:
      if not entry[-2:]=="\r\n":
        entry+="\r\n"
    self.listlock.acquire()
    while len(self.history) >= self.maxlist:
      self.history.pop(0)
    self.sequence+=1
    self.history.append(NmeaEntry(entry,source,omitDecode,sourcePriority))
    self.listlock.notify_all()
    self.listlock.release()
    AVNLog.debug("addNMEA history=%d data=%s",len(self.history), entry)
    return True

  def wakeUp(self):
    super().wakeUp()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()

  def get_messages(self, chunk_size=10, nmea_filter=None, handler_name="unknown", timeout=2, discard_time=1):
    """yields chunks of unprocessed messages
    - chunks may be shorter than requested or emtpy
    - yield single messages if chunk_size==1
    - discards messages if not all messages have be processed within discard_time"""
    assert chunk_size>=0
    seq=0 # sequence id of last processed message
    t0=time.monotonic() # timestamp when pipeline was empty
    while True:
      with self.listlock:
        history,sequence=self.history,self.sequence
        start=seq+1 # first seq id of messages to yield
        end=start+chunk_size # last seq id of msgs to yield, exclusive
        unprocessed=sequence-seq # number of unprocessed messages
        filled_since=time.monotonic()-t0 # time since pipeline has been emptied
        #print("unprocessed",unprocessed,"seq",(seq,sequence),f"age {filled_since:.3f}","S/E",(start,end))
        if unprocessed>len(history): # buffer overflow, too many massages
          lost=unprocessed-len(history)
          AVNLog.error("%s lost %d messages", handler_name, lost)
          #print("OVERFLOW",lost)
          start=sequence-len(history)
          seq=start
          unprocessed=sequence-seq
        if filled_since>discard_time and unprocessed>chunk_size: # force empty pipeline, discard messages
          end=sequence+1 # +1 because end is exclusive
          start=max(seq+1,end-chunk_size) # yield newest msgs from buffer
          AVNLog.error("%s discarded %d messages", handler_name, start-(seq+1))
          #print("DISCARDED",start-(seq+1),"S/E",(start,end))
          seq=min(start-1,sequence)
        o=sequence-len(history)+1 # offset=sequence-array_index
        start,end=start-o,end-o # seq --> history index
        end=min(end,len(history)) # limit chunk to available data
        assert 0<=start<=len(history) and 0<=end<=len(history), (start,end,len(history))
        messages=history[start:end]
        seq+=len(messages)
        assert seq<=sequence,(seq,sequence)
        empty=end==len(history) # pipeline is empty now
        if not messages: # wait for new messages
          self.listlock.wait(timeout)
        if empty:
          t0=time.monotonic() # reset time after waiting, it has been empty until now
        if self.sequence>sequence: # new messages are available now
          assert not messages
          continue
        #print("yield",len(messages),"empty" if empty else "")
      assert len(messages)<=chunk_size
      # filtering should better happen outside in the handler itself
      messages=list(filter(lambda m:NMEAParser.checkFilter(m.data,nmea_filter), messages))
      yield messages if chunk_size>1 else messages[0] if messages else None

  #fetch entries from the history
  #only return entries with higher sequence
  #return a tuple (lastSequence,[listOfEntries])
  #when sequence == None or 0 - just fetch the topmost entries (maxEntries)
  def fetchFromHistory(self,sequence,maxEntries=100,includeSource=False,waitTime=0.1,nmeafilter=None, returnError=False):
    seq=0
    list=[]
    if waitTime <=0:
      waitTime=0.1
    if maxEntries< 0:
      maxEntries=0
    if sequence is None:
      sequence=0
    stop = time.time() + waitTime
    numErrors=0
    self.listlock.acquire()
    if sequence <= 0:
      #if a new connection is opened - always wait for a new entry before sending out
      #sequence = 0 or sequence = None is a new connection
      #self.sequence starts at 1
      sequence=self.sequence
    try:
      while len(list) < 1:
        seq=self.sequence
        if seq > sequence:
          if (seq-sequence) > maxEntries:
            numErrors=(seq-sequence)-maxEntries #we missed some entries
            seq=sequence+maxEntries
          start=seq-sequence
          list=self.history[-start:]
        if len(list) < 1:
          wait = stop - time.time()
          if wait <= 0:
            break
          self.listlock.wait(wait)
    except:
      pass
    self.listlock.release()
    if len(list) < 1:
      if returnError:
        return (numErrors,seq,list)
      return (seq,list)
    if includeSource:
      if nmeafilter is None:
        if returnError:
          return (numErrors,seq,list)
        return (seq,list)
      rl=[el for el in list if NMEAParser.checkFilter(el.data,nmeafilter)]
      if returnError:
        return (numErrors,seq,rl)
      return (seq,rl)
    else:
      rt=[]
      for le in list:
        if NMEAParser.checkFilter(le.data,nmeafilter):
          rt.append(le.data)
      if returnError:
        return (numErrors,seq,rt)
      return (seq,rt)

  #a standalone feeder that uses our bultin methods
  
  def run(self):
    AVNLog.info("standalone feeder started")
    nmeaParser=NMEAParser(self.navdata)
    self.setInfo('main', "running", WorkerStatus.RUNNING)
    while not self.shouldStop():
      try:
        for chunk in self.get_messages(nmea_filter=self.nmeaFilter,handler_name="decoder"):
          if self.shouldStop(): break
          self.setInfo('main',"feeding NMEA", WorkerStatus.NMEA)
          for msg in chunk:
            if not msg is None and not msg.omitDecode:
              nmeaParser.parseData(msg.data,source=msg.source,sourcePriority=msg.sourcePriority)
      except Exception as e:
        AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())


class AVNGpsdFeeder(AVNFeeder):
  '''
  legacy config support with AVNGpsdFeeder
  '''

  @classmethod
  def autoInstantiate(cls):
    return False


avnav_handlerList.registerHandler(AVNGpsdFeeder)
avnav_handlerList.registerHandler(AVNFeeder)
